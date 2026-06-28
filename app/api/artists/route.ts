import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getArtists } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function pageNumber(value: string | null, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < (max ? 1 : 0)) return fallback;
  return max ? Math.min(Math.floor(parsed), max) : Math.floor(parsed);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = pageNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = pageNumber(url.searchParams.get("offset"), 0);
  const artists = await getArtists({ limit: limit + 1, offset });
  return NextResponse.json({ artists: artists.slice(0, limit), has_more: artists.length > limit });
}
