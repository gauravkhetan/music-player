import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentlyPlayed, recordRecentlyPlayed } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ songs: await getRecentlyPlayed(session.user.email) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { song_id?: string };
  if (!body.song_id) return NextResponse.json({ error: "song_id is required" }, { status: 400 });

  await recordRecentlyPlayed(session.user.email, body.song_id);
  return NextResponse.json({ ok: true, song_id: body.song_id });
}
