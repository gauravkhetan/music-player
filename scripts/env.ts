import { readFile } from "node:fs/promises";
import path from "node:path";

export type ScriptEnv = Record<string, string | undefined>;

export function parseEnv(raw: string) {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

export async function loadScriptEnv(): Promise<ScriptEnv> {
  const localEnvPath = path.join(process.cwd(), ".env.local");
  try {
    return { ...parseEnv(await readFile(localEnvPath, "utf8")), ...process.env };
  } catch {
    return process.env;
  }
}
