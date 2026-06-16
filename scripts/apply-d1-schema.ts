import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadScriptEnv } from "./env";

type D1Response = {
  success: boolean;
  errors?: Array<{ message: string }>;
};

function splitSql(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const env = await loadScriptEnv();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !token) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN in .env.local first.");
  }

  const schema = await readFile(path.join(process.cwd(), "schema.sql"), "utf8");
  const statements = splitSql(schema);

  for (const sql of statements) {
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
      const message = payload.errors?.map((error) => error.message).join("; ") || "D1 schema query failed";
      throw new Error(message);
    }
  }

  console.log(`Applied ${statements.length} schema statements to Cloudflare D1.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
