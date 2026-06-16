import { loadScriptEnv } from "./env";

type D1Response = {
  success: boolean;
  errors?: Array<{ message: string }>;
};

async function queryD1(sql: string) {
  const env = await loadScriptEnv();
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
    body: JSON.stringify({ sql })
  });
  const payload = (await response.json()) as D1Response;
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "D1 query failed");
  }
}

async function main() {
  await queryD1("UPDATE songs SET cover_url = NULL");
  await queryD1("UPDATE artists SET image_url = NULL");
  await queryD1("UPDATE albums SET cover_url = NULL");
  console.log("Cleared generated cover/image URLs from D1.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
