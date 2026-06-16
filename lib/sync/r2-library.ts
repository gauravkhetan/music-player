import { createHash } from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export type SyncEnv = Record<string, string | undefined>;

type D1Response = {
  success: boolean;
  errors?: Array<{ message: string }>;
};

type SongMetadata = {
  id: string;
  sourceKey: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  audioUrl: string;
  trackNumber: number | null;
  year: number | null;
};

export type SyncResult = {
  scannedObjects: number;
  mp3Objects: number;
  importedSongs: number;
  prefix: string;
  reset: boolean;
};

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function songIdFromKey(key: string) {
  return `r2-${createHash("sha1").update(key).digest("hex").slice(0, 24)}`;
}

function cleanTitle(fileName: string) {
  return decodeURIComponent(fileName)
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{6,}/, "")
    .replace(/^\d+\s*[-_.]\s*/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function inferTrackNumber(fileName: string) {
  const decoded = decodeURIComponent(fileName);
  const numbered = decoded.match(/^(\d{1,3})\s*[-_.]/);
  if (numbered) return Number(numbered[1]);
  const longPrefix = decoded.match(/^(\d{6,})/);
  if (!longPrefix) return null;
  const parsed = Number(longPrefix[1].slice(-3));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function parseSongKey(key: string, publicBaseUrl: string, importPrefix: string, coversBaseUrl?: string): SongMetadata | null {
  const relativeKey = importPrefix && key.startsWith(importPrefix) ? key.slice(importPrefix.length) : key;
  const relativeParts = relativeKey.split("/");
  if (relativeParts.length < 2) return null;

  const fileName = relativeParts.at(-1);
  if (!fileName || !/\.mp3$/i.test(fileName)) return null;

  const artistPart = relativeParts[0];
  const albumPart = relativeParts.length >= 3 ? relativeParts[1] : "Unknown Album";
  const artist = decodeURIComponent(artistPart);
  const album = decodeURIComponent(albumPart);
  const title = cleanTitle(fileName);
  const coverKey = `covers/${artistPart}/${albumPart}.jpg`;
  const coverUrl = coversBaseUrl ? `${coversBaseUrl.replace(/\/$/, "")}/${encodeObjectKey(coverKey)}` : null;

  return {
    id: songIdFromKey(key),
    sourceKey: key,
    title,
    artist,
    album,
    coverUrl,
    audioUrl: `${publicBaseUrl.replace(/\/$/, "")}/${encodeObjectKey(key)}`,
    trackNumber: inferTrackNumber(fileName),
    year: null
  };
}

async function queryD1(env: SyncEnv, sql: string, params: unknown[] = []) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });
  const payload = (await response.json()) as D1Response;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).join("; ") || "D1 query failed";
    throw new Error(message);
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function listObjectKeys(env: SyncEnv, prefix = "") {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = env.R2_BUCKET_NAME;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function ensureSchema(env: SyncEnv) {
  await queryD1(env, "CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_audio_url ON songs(audio_url)");
  await queryD1(env, "CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at)");
}

async function resetImportedLibrary(env: SyncEnv) {
  await queryD1(env, "DELETE FROM recently_played");
  await queryD1(env, "DELETE FROM favorites");
  await queryD1(env, "DELETE FROM playlist_songs");
  await queryD1(env, "DELETE FROM songs");
  await queryD1(env, "DELETE FROM artists");
  await queryD1(env, "DELETE FROM albums");
}

async function upsertSongs(env: SyncEnv, songs: SongMetadata[]) {
  const artists = new Map<string, [string, string, string | null]>();
  const albums = new Map<string, [string, string, string, string | null, number | null]>();

  for (const song of songs) {
    artists.set(slug(song.artist), [slug(song.artist), song.artist, song.coverUrl]);
    albums.set(slug(`${song.artist}-${song.album}`), [slug(`${song.artist}-${song.album}`), song.album, song.artist, song.coverUrl, song.year]);
  }

  for (const group of chunk([...artists.values()], 25)) {
    const placeholders = group.map(() => "(?, ?, ?)").join(", ");
    await queryD1(env, `INSERT OR IGNORE INTO artists (id, name, image_url) VALUES ${placeholders}`, group.flat());
  }

  for (const group of chunk([...albums.values()], 20)) {
    const placeholders = group.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await queryD1(env, `INSERT OR IGNORE INTO albums (id, title, artist, cover_url, year) VALUES ${placeholders}`, group.flat());
  }

  for (const group of chunk(songs, 10)) {
    const placeholders = group.map(() => "(?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)").join(", ");
    await queryD1(
      env,
      `INSERT OR REPLACE INTO songs (id, title, artist, album, genre, duration, cover_url, audio_url, track_number, year) VALUES ${placeholders}`,
      group.flatMap((song) => [song.id, song.title, song.artist, song.album, song.coverUrl, song.audioUrl, song.trackNumber, song.year])
    );
  }
}

export async function syncR2Library(env: SyncEnv, options: { reset?: boolean } = {}): Promise<SyncResult> {
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL;
  if (!publicBaseUrl || publicBaseUrl.includes("cdn.example.com")) {
    throw new Error("Set R2_PUBLIC_BASE_URL to your real public R2/CDN domain.");
  }

  await ensureSchema(env);

  let importPrefix = env.R2_SONGS_PREFIX ?? "songs/";
  let objectKeys = await listObjectKeys(env, importPrefix);
  if (!objectKeys.some((key) => /\.mp3$/i.test(key)) && importPrefix) {
    importPrefix = "";
    objectKeys = await listObjectKeys(env, importPrefix);
  }

  const keys = objectKeys.filter((key) => /\.mp3$/i.test(key));
  const songs = keys
    .map((key) => parseSongKey(key, publicBaseUrl, importPrefix, env.R2_COVERS_BASE_URL))
    .filter((song): song is SongMetadata => Boolean(song));

  if (options.reset) await resetImportedLibrary(env);
  await upsertSongs(env, songs);

  return {
    scannedObjects: objectKeys.length,
    mp3Objects: keys.length,
    importedSongs: songs.length,
    prefix: importPrefix,
    reset: Boolean(options.reset)
  };
}
