import "server-only";

type D1Result<T> = {
  success: boolean;
  result?: Array<{ results?: T[] }>;
  errors?: Array<{ message: string }>;
};

export function hasD1Config() {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_D1_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function queryD1<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store"
  });

  const payload = (await response.json()) as D1Result<T>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).join("; ") || "D1 query failed";
    if (message.toLowerCase().includes("no such table")) {
      console.warn(`[D1] ${message}. Run "npm run d1:schema" to apply schema.sql.`);
      return [];
    }
    throw new Error(message);
  }

  return payload.result?.flatMap((item) => item.results ?? []) ?? [];
}
