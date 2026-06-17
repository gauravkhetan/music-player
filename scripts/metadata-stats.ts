import { loadScriptEnv } from "./env";
import { queryD1 } from "./cloud";

async function main() {
  const env = await loadScriptEnv();
  const counts = await queryD1<{ metadata_confidence: string | null; count: number }>(
    env,
    "SELECT COALESCE(metadata_confidence, 'null') AS metadata_confidence, COUNT(*) AS count FROM songs GROUP BY metadata_confidence ORDER BY count DESC"
  );
  const samples = await queryD1<{ title: string; artist: string; album: string; metadata_confidence: string | null }>(
    env,
    "SELECT title, artist, album, metadata_confidence FROM songs ORDER BY title COLLATE NOCASE LIMIT 12"
  );

  console.log("Metadata confidence counts:");
  for (const row of counts) console.log(`- ${row.metadata_confidence}: ${row.count}`);
  console.log("\nSample songs:");
  for (const song of samples) console.log(`- ${song.title} | ${song.artist} | ${song.album} | ${song.metadata_confidence}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
