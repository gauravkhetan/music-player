import { loadScriptEnv } from "./env";

type D1Response = {
  success: boolean;
  result?: Array<{ results?: Array<{ count: number }> }>;
  errors?: Array<{ message: string }>;
};

async function main() {
  const env = await loadScriptEnv();
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
    body: JSON.stringify({ sql: "SELECT COUNT(*) AS count FROM songs" })
  });
  const payload = (await response.json()) as D1Response;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).join("; ") || "D1 count failed";
    throw new Error(message);
  }

  console.log(payload.result?.[0]?.results?.[0]?.count ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
