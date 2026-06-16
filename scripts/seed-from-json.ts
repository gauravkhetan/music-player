import { readFile } from "node:fs/promises";
import { basename } from "node:path";

type SongInput = {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre?: string | null;
  duration?: number | null;
  cover_url?: string | null;
  audio_url: string;
  track_number?: number | null;
  year?: number | null;
  created_at?: string;
};

type SeedInput = {
  songs: SongInput[];
};

function sqlString(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run seed:json -- path/to/library.json > seed.sql");
  }
  const payload = JSON.parse(await readFile(inputPath, "utf8")) as SeedInput;
  console.log(`-- Generated from ${basename(inputPath)}`);
  console.log("BEGIN TRANSACTION;");
  for (const song of payload.songs) {
    console.log(
      `INSERT OR REPLACE INTO songs (id,title,artist,album,genre,duration,cover_url,audio_url,track_number,year,created_at) VALUES (${[
        song.id,
        song.title,
        song.artist,
        song.album,
        song.genre ?? null,
        song.duration ?? null,
        song.cover_url ?? null,
        song.audio_url,
        song.track_number ?? null,
        song.year ?? null,
        song.created_at ?? new Date().toISOString()
      ].map(sqlString).join(",")});`
    );
    console.log(`INSERT OR IGNORE INTO artists (id,name,image_url) VALUES (${sqlString(slug(song.artist))},${sqlString(song.artist)},${sqlString(song.cover_url ?? null)});`);
    console.log(`INSERT OR IGNORE INTO albums (id,title,artist,cover_url,year) VALUES (${sqlString(slug(`${song.artist}-${song.album}`))},${sqlString(song.album)},${sqlString(song.artist)},${sqlString(song.cover_url ?? null)},${sqlString(song.year ?? null)});`);
  }
  console.log("COMMIT;");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
