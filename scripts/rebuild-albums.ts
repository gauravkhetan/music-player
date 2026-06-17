import { slug } from "../lib/artist-utils";
import { queryD1 } from "./cloud";
import { loadScriptEnv } from "./env";

type SongAlbumRow = {
  album: string;
  artist: string;
  cover_url: string | null;
  year: number | null;
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function main() {
  const env = await loadScriptEnv();
  const songs = await queryD1<SongAlbumRow>(
    env,
    "SELECT album, artist, cover_url, year FROM songs WHERE album IS NOT NULL AND album != ''"
  );
  const albums = new Map<string, { id: string; title: string; artist: string; cover_url: string | null; year: number | null; song_count: number }>();

  for (const song of songs) {
    const id = slug(song.album);
    const current = albums.get(id);
    albums.set(id, {
      id,
      title: song.album,
      artist: current?.artist ?? song.artist,
      cover_url: current?.cover_url ?? song.cover_url,
      year: current?.year ?? song.year,
      song_count: (current?.song_count ?? 0) + 1
    });
  }

  await queryD1(env, "DELETE FROM albums");
  for (const group of chunk([...albums.values()], 20)) {
    const placeholders = group.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await queryD1(
      env,
      `INSERT OR REPLACE INTO albums (id, title, artist, cover_url, year) VALUES ${placeholders}`,
      group.flatMap((album) => [album.id, album.title, album.artist, album.cover_url, album.year])
    );
  }

  console.log(`Rebuilt ${albums.size} album rows from ${songs.length} songs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
