import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ScriptEnv } from "./env";

type D1Response<T> = {
  success: boolean;
  result?: Array<{ results?: T[] }>;
  errors?: Array<{ message: string }>;
};

export async function queryD1<T>(env: ScriptEnv, sql: string, params: unknown[] = []) {
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
    body: JSON.stringify({ sql, params })
  });
  const payload = (await response.json()) as D1Response<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "D1 query failed");
  }
  return payload.result?.flatMap((item) => item.results ?? []) ?? [];
}

export function createR2Client(env: ScriptEnv) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

export async function getR2ObjectBuffer(env: ScriptEnv, key: string) {
  const bucket = env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Set R2_BUCKET_NAME.");

  const response = await createR2Client(env).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`R2 object has no body: ${key}`);
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function getR2ObjectRangeBuffer(env: ScriptEnv, key: string, start = 0, end = 64 * 1024 - 1) {
  const bucket = env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Set R2_BUCKET_NAME.");

  const response = await createR2Client(env).send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: `bytes=${start}-${end}`
  }));
  if (!response.Body) throw new Error(`R2 object has no body: ${key}`);
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function putR2Object(env: ScriptEnv, key: string, body: Buffer, contentType: string) {
  const bucket = env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Set R2_BUCKET_NAME.");

  await createR2Client(env).send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
}

export function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
