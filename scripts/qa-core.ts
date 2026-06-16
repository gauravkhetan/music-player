import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadScriptEnv } from "./env";

type Env = Record<string, string | undefined>;
type QueryPayload<T> = {
  success: boolean;
  result?: Array<{ results?: T[] }>;
  errors?: Array<{ message: string }>;
};
type SongRow = {
  id: string;
  title: string;
  audio_url: string;
  source_key?: string | null;
};

async function queryD1<T>(env: Env, sql: string, params: unknown[] = []) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) throw new Error("D1 env vars are missing.");

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });
  const payload = (await response.json()) as QueryPayload<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "D1 query failed");
  }
  return payload.result?.flatMap((item) => item.results ?? []) ?? [];
}

function objectKeyFromSong(env: Env, song: SongRow) {
  if (song.source_key) return song.source_key;
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL;
  if (publicBaseUrl && song.audio_url.startsWith(publicBaseUrl)) {
    return decodeURIComponent(song.audio_url.slice(publicBaseUrl.length).replace(/^\/+/, ""));
  }
  const url = new URL(song.audio_url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (env.R2_BUCKET_NAME && parts[0] === env.R2_BUCKET_NAME) parts.shift();
  return decodeURIComponent(parts.join("/"));
}

async function assertSignedAudioFetch(env: Env, song: SongRow) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    throw new Error("R2 signing env vars are missing.");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY
    }
  });
  const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: objectKeyFromSong(env, song) }), { expiresIn: 300 });
  const response = await fetch(signedUrl, { headers: { Range: "bytes=0-1" } });
  if (![200, 206].includes(response.status)) {
    throw new Error(`Signed audio fetch failed with HTTP ${response.status}`);
  }
}

function getQaEmail(env: Env) {
  return env.ALLOWED_EMAILS?.split(",").map((email) => email.trim()).find(Boolean) ?? "qa@example.com";
}

async function main() {
  const env = await loadScriptEnv();
  const [{ count }] = await queryD1<{ count: number }>(env, "SELECT COUNT(*) AS count FROM songs");
  if (!count || count < 1) throw new Error("No songs found in D1.");

  const [badCoverRows] = await queryD1<{ count: number }>(
    env,
    "SELECT COUNT(*) AS count FROM songs WHERE cover_url LIKE '%r2.cloudflarestorage.com%'"
  );
  if (badCoverRows?.count) throw new Error(`Found ${badCoverRows.count} non-public generated cover URLs.`);

  const [song] = await queryD1<SongRow>(env, "SELECT id, title, audio_url FROM songs ORDER BY title COLLATE NOCASE LIMIT 1");
  if (!song) throw new Error("Could not load a test song.");
  await assertSignedAudioFetch(env, song);

  const email = getQaEmail(env);
  await queryD1(env, "INSERT OR IGNORE INTO favorites (user_email, song_id) VALUES (?, ?)", [email, song.id]);
  const favoriteRows = await queryD1<{ count: number }>(env, "SELECT COUNT(*) AS count FROM favorites WHERE user_email = ? AND song_id = ?", [email, song.id]);
  if (favoriteRows[0]?.count !== 1) throw new Error("Favorite insert failed.");
  await queryD1(env, "DELETE FROM favorites WHERE user_email = ? AND song_id = ?", [email, song.id]);
  const afterDelete = await queryD1<{ count: number }>(env, "SELECT COUNT(*) AS count FROM favorites WHERE user_email = ? AND song_id = ?", [email, song.id]);
  if (afterDelete[0]?.count !== 0) throw new Error("Favorite delete failed.");

  const playlistId = `qa-${Date.now()}`;
  await queryD1(env, "INSERT INTO playlists (id, name, created_by) VALUES (?, ?, ?)", [playlistId, "QA Playlist", email]);
  await queryD1(env, "INSERT OR REPLACE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)", [playlistId, song.id, 1]);
  const playlistRows = await queryD1<{ count: number }>(env, "SELECT COUNT(*) AS count FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", [playlistId, song.id]);
  if (playlistRows[0]?.count !== 1) throw new Error("Playlist song insert failed.");
  await queryD1(env, "DELETE FROM playlist_songs WHERE playlist_id = ?", [playlistId]);
  await queryD1(env, "DELETE FROM playlists WHERE id = ?", [playlistId]);

  const playedAt = new Date().toISOString();
  await queryD1(env, "INSERT INTO recently_played (user_email, song_id, played_at) VALUES (?, ?, ?)", [email, song.id, playedAt]);
  const playedRows = await queryD1<{ count: number }>(env, "SELECT COUNT(*) AS count FROM recently_played WHERE user_email = ? AND song_id = ? AND played_at = ?", [email, song.id, playedAt]);
  if (playedRows[0]?.count !== 1) throw new Error("Recently played insert failed.");
  await queryD1(env, "DELETE FROM recently_played WHERE user_email = ? AND song_id = ? AND played_at = ?", [email, song.id, playedAt]);

  console.log(`QA passed: ${count} songs, signed playback fetch, covers, favorites, playlists, and recently played.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
