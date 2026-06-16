import { NextResponse } from "next/server";
import { syncR2Library } from "@/lib/sync/r2-library";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const syncSecret = process.env.SYNC_SECRET;
  const url = new URL(request.url);
  const reset = url.searchParams.get("reset") === "true";
  const userAgent = request.headers.get("user-agent") ?? "";

  if (!reset && userAgent.includes("vercel-cron/1.0")) return true;
  if (!syncSecret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${syncSecret}`) return true;

  return url.searchParams.get("secret") === syncSecret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reset = url.searchParams.get("reset") === "true";
  const result = await syncR2Library(process.env, { reset });
  return NextResponse.json(result);
}
