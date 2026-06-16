import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addFavorite, getFavorites, removeFavorite } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const songs = await getFavorites(session.user.email);
  return NextResponse.json({ songs, song_ids: songs.map((song) => song.id) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { song_id?: string };
  if (!body.song_id) return NextResponse.json({ error: "song_id is required" }, { status: 400 });

  await addFavorite(session.user.email, body.song_id);
  return NextResponse.json({ ok: true, song_id: body.song_id });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const songId = url.searchParams.get("song_id");
  if (!songId) return NextResponse.json({ error: "song_id is required" }, { status: 400 });

  await removeFavorite(session.user.email, songId);
  return NextResponse.json({ ok: true, song_id: songId });
}
