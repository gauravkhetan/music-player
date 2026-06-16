import { loadScriptEnv } from "./env";
import { syncR2Library } from "../lib/sync/r2-library";

async function main() {
  const env = await loadScriptEnv();
  const reset = process.argv.includes("--reset");
  const result = await syncR2Library(env, { reset });
  console.log(`Imported ${result.importedSongs} MP3 objects from R2 into D1.`);
  console.log(`Scanned ${result.scannedObjects} objects with prefix "${result.prefix || "(bucket root)"}". Reset: ${result.reset ? "yes" : "no"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
