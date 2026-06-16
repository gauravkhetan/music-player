import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSongs } from "@/lib/db";
import type { SortKey } from "@/types/music";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const songs = await getSongs({
    search: url.searchParams.get("q") ?? undefined,
    sort: (url.searchParams.get("sort") as SortKey | null) ?? "title",
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0)
  });
  return NextResponse.json({ songs });
}
