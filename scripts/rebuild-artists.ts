import { slug, splitArtistNames } from "../lib/artist-utils";
import { queryD1 } from "./cloud";
import { loadScriptEnv } from "./env";

type SongArtistRow = {
  artist: string;
  cover_url: string | null;
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function main() {
  const env = await loadScriptEnv();
  const songs = await queryD1<SongArtistRow>(
    env,
    "SELECT artist, cover_url FROM songs WHERE artist IS NOT NULL AND artist != ''"
  );
  const artists = new Map<string, { id: string; name: string; image_url: string | null; song_count: number }>();

  for (const song of songs) {
    for (const name of splitArtistNames(song.artist)) {
      const id = slug(name);
      const current = artists.get(id);
      artists.set(id, {
        id,
        name,
        image_url: current?.image_url ?? song.cover_url,
        song_count: (current?.song_count ?? 0) + 1
      });
    }
  }

  await queryD1(env, "DELETE FROM artists");
  for (const group of chunk([...artists.values()], 25)) {
    const placeholders = group.map(() => "(?, ?, ?)").join(", ");
    await queryD1(
      env,
      `INSERT OR REPLACE INTO artists (id, name, image_url) VALUES ${placeholders}`,
      group.flatMap((artist) => [artist.id, artist.name, artist.image_url])
    );
  }

  console.log(`Rebuilt ${artists.size} artist rows from ${songs.length} songs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
