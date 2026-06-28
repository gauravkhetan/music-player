import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileTypeFromBuffer } from "file-type";
import { parseBuffer } from "music-metadata";
import { slug, splitArtistNames } from "../lib/artist-utils";
import { loadScriptEnv } from "./env";
import { encodeObjectKey, getR2ObjectBuffer, getR2ObjectRangeBuffer, putR2Object, queryD1 } from "./cloud";

type Confidence = "high" | "medium" | "low" | "unmatched";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  duration: number | null;
  cover_url: string | null;
  audio_url: string;
  source_key: string | null;
  track_number: number | null;
  year: number | null;
  metadata_source: string | null;
  metadata_confidence: Confidence | null;
  enriched_at: string | null;
};

type ReviewItem = {
  id: string;
  source_key: string;
  old_title: string;
  cleaned_title: string;
  reason: string;
  metadata_source: string;
  metadata_confidence: Confidence;
};

type EnrichedMetadata = {
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  duration: number | null;
  year: number | null;
  trackNumber: number | null;
  coverUrl: string | null;
  source: string;
  confidence: Confidence;
  review: string | null;
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function titleCase(value: string) {
  const lowerWords = new Set(["a", "an", "and", "or", "the", "of", "in", "on", "to", "se"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowerWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanSongTitleFromName(value: string) {
  const withoutExt = decodeURIComponent(value).replace(/\.[a-z0-9]{2,5}$/i, "");
  return withoutExt
    .replace(/^[0-9a-f]{8}(?=[A-Z])/i, "")
    .replace(/^\s*\d+\s*[-_.]\s*/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function objectKeyFromSong(song: SongRow, env?: Record<string, string | undefined>) {
  if (song.source_key) return song.source_key;

  if (env?.R2_PUBLIC_BASE_URL && song.audio_url.startsWith(env.R2_PUBLIC_BASE_URL)) {
    return decodeURIComponent(song.audio_url.slice(env.R2_PUBLIC_BASE_URL.length).replace(/^\/+/, ""));
  }

  const url = new URL(song.audio_url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (env?.R2_BUCKET_NAME && parts[0] === env.R2_BUCKET_NAME) parts.shift();
  return decodeURIComponent(parts.join("/"));
}

function fileNameFromKey(key: string) {
  return key.split("/").at(-1) ?? key;
}

function extractYear(value?: string | number | Date) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getFullYear();
  const match = String(value).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function getPictureExtension(mime?: string) {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  return "jpg";
}

function buildCoverPublicUrl(env: Record<string, string | undefined>, key: string) {
  const base = env.R2_COVERS_BASE_URL || env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${encodeObjectKey(key)}`;
}

async function uploadCoverIfPresent(env: Record<string, string | undefined>, song: SongRow, picture?: { data: Uint8Array; format: string }) {
  if (!picture?.data?.byteLength) return null;

  const buffer = Buffer.from(picture.data);
  const type = await fileTypeFromBuffer(buffer);
  const contentType = type?.mime ?? picture.format ?? "image/jpeg";
  const extension = type?.ext ?? getPictureExtension(contentType);
  const key = `covers/${slug(song.artist || "unknown-artist")}/${song.id}.${extension}`;
  await putR2Object(env, key, buffer, contentType);
  return buildCoverPublicUrl(env, key);
}

async function runFpcalc(fileBuffer: Buffer) {
  const tempPath = `${tmpdir()}/music-${createHash("sha1").update(fileBuffer).digest("hex")}.mp3`;
  await writeFile(tempPath, fileBuffer);
  const fpcalcPath = process.env.FPCALC_PATH ?? "fpcalc";

  return new Promise<{ duration: number; fingerprint: string } | null>((resolve) => {
    const child = spawn(fpcalcPath, ["-json", tempPath]);
    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += String(data);
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const parsed = JSON.parse(stdout) as { duration?: number; fingerprint?: string };
        if (!parsed.duration || !parsed.fingerprint) return resolve(null);
        resolve({ duration: parsed.duration, fingerprint: parsed.fingerprint });
      } catch {
        resolve(null);
      }
    });
  });
}

async function lookupAcoustId(env: Record<string, string | undefined>, fileBuffer: Buffer) {
  if (!env.ACOUSTID_API_KEY) return null;
  const fingerprint = await runFpcalc(fileBuffer);
  if (!fingerprint) return null;

  const body = new URLSearchParams({
    client: env.ACOUSTID_API_KEY,
    duration: String(Math.round(fingerprint.duration)),
    fingerprint: fingerprint.fingerprint,
    meta: "recordings releasegroups compress",
    format: "json"
  });

  const response = await fetch("https://api.acoustid.org/v2/lookup", {
    method: "POST",
    body
  });
  if (!response.ok) return null;

  const payload = await response.json() as {
    results?: Array<{
      score?: number;
      recordings?: Array<{
        title?: string;
        artists?: Array<{ name?: string }>;
        releasegroups?: Array<{ title?: string }>;
      }>;
    }>;
  };
  const result = payload.results?.find((item) => (item.score ?? 0) >= 0.85 && item.recordings?.length);
  const recording = result?.recordings?.[0];
  if (!result || !recording?.title) return null;

  return {
    title: titleCase(recording.title),
    artist: recording.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown Artist",
    album: recording.releasegroups?.[0]?.title || "Unknown Album",
    confidence: (result.score ?? 0) >= 0.95 ? "high" as const : "medium" as const,
    score: result.score ?? 0
  };
}

async function enrichSong(env: Record<string, string | undefined>, song: SongRow, options: { fingerprint: boolean }): Promise<{ metadata: EnrichedMetadata; review?: ReviewItem }> {
  const key = objectKeyFromSong(song, env);
  const cleanedTitle = titleCase(cleanSongTitleFromName(fileNameFromKey(key)) || song.title);
  const tagBuffer = await getR2ObjectRangeBuffer(env, key);
  const parsed = await parseBuffer(tagBuffer, undefined, { duration: true }).catch(() => null);
  const common = parsed?.common;
  const format = parsed?.format;
  const tagTitle = common?.title?.trim();
  const tagArtist = common?.artist?.trim() || common?.artists?.join(", ") || common?.albumartist?.trim();
  const tagAlbum = common?.album?.trim();
  const tagGenre = common?.genre?.join(", ") || null;
  const tagYear = extractYear(common?.year ?? common?.date);
  const trackNumber = common?.track?.no ?? song.track_number ?? null;
  const duration = format?.duration ? Math.round(format.duration) : song.duration;
  const coverUrl = await uploadCoverIfPresent(env, song, common?.picture?.[0]);

  if (tagTitle || tagArtist || tagAlbum || tagGenre || tagYear || coverUrl) {
    return {
      metadata: {
        title: titleCase(tagTitle || cleanedTitle),
        artist: tagArtist || "Unknown Artist",
        album: tagAlbum || "Unknown Album",
        genre: tagGenre,
        duration,
        year: tagYear,
        trackNumber,
        coverUrl,
        source: "id3",
        confidence: tagTitle && tagArtist ? "high" : "medium",
        review: tagTitle && tagArtist ? null : "Partial ID3 metadata; title cleaned from filename or artist/album missing."
      }
    };
  }

  const acoustId = options.fingerprint ? await lookupAcoustId(env, await getR2ObjectBuffer(env, key)) : null;
  if (acoustId) {
    return {
      metadata: {
        title: acoustId.title,
        artist: acoustId.artist,
        album: acoustId.album,
        genre: null,
        duration,
        year: null,
        trackNumber,
        coverUrl: null,
        source: "acoustid",
        confidence: acoustId.confidence,
        review: `AcoustID score ${acoustId.score.toFixed(3)}`
      }
    };
  }

  const review: ReviewItem = {
    id: song.id,
    source_key: key,
    old_title: song.title,
    cleaned_title: cleanedTitle,
    reason: "No useful ID3 tags and no confident fingerprint match.",
    metadata_source: "filename",
    metadata_confidence: "unmatched"
  };

  return {
    metadata: {
      title: cleanedTitle,
      artist: "Unknown Artist",
      album: "Unknown Album",
      genre: null,
      duration,
      year: null,
      trackNumber,
      coverUrl: null,
      source: "filename",
      confidence: "unmatched",
      review: review.reason
    },
    review
  };
}

function enrichTitleOnly(env: Record<string, string | undefined>, song: SongRow): { metadata: EnrichedMetadata; review: ReviewItem } {
  const key = objectKeyFromSong(song, env);
  const cleanedTitle = titleCase(cleanSongTitleFromName(fileNameFromKey(key)) || song.title);
  const review: ReviewItem = {
    id: song.id,
    source_key: key,
    old_title: song.title,
    cleaned_title: cleanedTitle,
    reason: "Title cleaned from filename; artist/album still needs metadata review.",
    metadata_source: "filename",
    metadata_confidence: "unmatched"
  };

  return {
    metadata: {
      title: cleanedTitle,
      artist: song.artist || "Unknown Artist",
      album: song.album || "Unknown Album",
      genre: song.genre,
      duration: song.duration,
      year: song.year,
      trackNumber: song.track_number,
      coverUrl: song.cover_url,
      source: "filename",
      confidence: "unmatched",
      review: review.reason
    },
    review
  };
}

async function ensureMetadataSchema(env: Record<string, string | undefined>) {
  const statements = [
    "ALTER TABLE songs ADD COLUMN source_key TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_source TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_confidence TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_review TEXT",
    "ALTER TABLE songs ADD COLUMN enriched_at DATETIME",
    "CREATE INDEX IF NOT EXISTS idx_songs_metadata_confidence ON songs(metadata_confidence)"
  ];
  for (const statement of statements) {
    await queryD1(env, statement).catch(() => undefined);
  }
}

async function updateSong(env: Record<string, string | undefined>, song: SongRow, metadata: EnrichedMetadata) {
  await queryD1(
    env,
    `UPDATE songs
     SET title = ?,
         artist = ?,
         album = ?,
         genre = ?,
         duration = ?,
         cover_url = ?,
         track_number = ?,
         year = ?,
         source_key = ?,
         metadata_source = ?,
         metadata_confidence = ?,
         metadata_review = ?,
         enriched_at = ?
     WHERE id = ?`,
    [
      metadata.title,
      metadata.artist,
      metadata.album,
      metadata.genre,
      metadata.duration,
      metadata.coverUrl,
      metadata.trackNumber,
      metadata.year,
      objectKeyFromSong(song, env),
      metadata.source,
      metadata.confidence,
      metadata.review,
      new Date().toISOString(),
      song.id
    ]
  );
}

async function rebuildArtistAlbumTables(env: Record<string, string | undefined>) {
  await queryD1(env, "DELETE FROM artists");
  await queryD1(env, "DELETE FROM albums");

  const songs = await queryD1<{ artist: string; cover_url: string | null }>(
    env,
    `SELECT artist, cover_url
     FROM songs
     WHERE artist IS NOT NULL AND artist != ''`
  );
  const artists = new Map<string, { id: string; name: string; image_url: string | null }>();
  for (const song of songs) {
    for (const name of splitArtistNames(song.artist)) {
      const id = slug(name);
      const current = artists.get(id);
      artists.set(id, { id, name, image_url: current?.image_url ?? song.cover_url });
    }
  }
  for (const group of chunk([...artists.values()], 25)) {
    const placeholders = group.map(() => "(?, ?, ?)").join(", ");
    await queryD1(env, `INSERT OR REPLACE INTO artists (id, name, image_url) VALUES ${placeholders}`, group.flatMap((artist) => [artist.id, artist.name, artist.image_url]));
  }

  const albums = await queryD1<{ id: string; title: string; artist: string; cover_url: string | null; year: number | null }>(
    env,
    `SELECT album AS title, MIN(artist) AS artist, MAX(cover_url) AS cover_url, MAX(year) AS year
     FROM songs
     WHERE album IS NOT NULL AND album != ''
     GROUP BY album`
  );
  for (const group of chunk(albums, 20)) {
    const placeholders = group.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await queryD1(
      env,
      `INSERT OR REPLACE INTO albums (id, title, artist, cover_url, year) VALUES ${placeholders}`,
      group.flatMap((album) => [slug(album.title), album.title, album.artist, album.cover_url, album.year])
    );
  }
}

async function main() {
  const env = await loadScriptEnv();
  const force = process.argv.includes("--force");
  const retryUnmatched = process.argv.includes("--retry-unmatched");
  const fingerprint = process.argv.includes("--fingerprint");
  const titlesOnly = process.argv.includes("--titles-only");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  const reviewPath = env.METADATA_REVIEW_PATH || "data/metadata-review.json";

  await ensureMetadataSchema(env);

  const where = force ? "" : retryUnmatched ? "WHERE enriched_at IS NULL OR metadata_confidence IN ('low', 'unmatched')" : "WHERE enriched_at IS NULL";
  const rows = await queryD1<SongRow>(
    env,
    `SELECT id, title, artist, album, genre, duration, cover_url, audio_url, source_key, track_number, year, metadata_source, metadata_confidence, enriched_at
     FROM songs
     ${where}
     ORDER BY title COLLATE NOCASE
     ${limit ? "LIMIT ?" : ""}`,
    limit ? [limit] : []
  );

  const reviews: ReviewItem[] = [];
  let processed = 0;
  let high = 0;
  let medium = 0;
  let unmatched = 0;
  let failed = 0;
  const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
  const concurrency = Math.max(1, Math.min(20, concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 6));
  let cursor = 0;

  async function processSong(song: SongRow) {
    try {
      const result = titlesOnly
        ? enrichTitleOnly(env, song)
        : await Promise.race([
            enrichSong(env, song, { fingerprint }),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("Timed out while reading metadata")), 15_000);
            })
          ]);
      await updateSong(env, song, result.metadata);
      if (result.review) reviews.push(result.review);
      processed += 1;
      if (result.metadata.confidence === "high") high += 1;
      else if (result.metadata.confidence === "medium") medium += 1;
      else if (result.metadata.confidence === "unmatched") unmatched += 1;
      if (processed % 25 === 0) {
        console.log(`Processed ${processed}/${rows.length} songs...`);
      }
    } catch (error) {
      failed += 1;
      reviews.push({
        id: song.id,
        source_key: objectKeyFromSong(song, env),
        old_title: song.title,
        cleaned_title: titleCase(cleanSongTitleFromName(fileNameFromKey(objectKeyFromSong(song, env))) || song.title),
        reason: error instanceof Error ? error.message : "Unknown enrichment error",
        metadata_source: "error",
        metadata_confidence: "unmatched"
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < rows.length) {
      const song = rows[cursor];
      cursor += 1;
      if (song) await processSong(song);
    }
  }));

  await rebuildArtistAlbumTables(env);
  await mkdir(dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, JSON.stringify({ generated_at: new Date().toISOString(), total_review_items: reviews.length, items: reviews }, null, 2));

  console.log(`Metadata enrichment complete. Processed ${processed}/${rows.length}. High: ${high}. Medium: ${medium}. Unmatched: ${unmatched}. Failed: ${failed}.`);
  console.log(`Review file: ${reviewPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
