import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasD1Config, queryD1 } from "@/lib/d1";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasD1Config()) return NextResponse.json({ error: "D1 is not configured" }, { status: 501 });

  const { id } = await params;
  const body = (await request.json()) as { song_id?: string; position?: number };
  if (!body.song_id) return NextResponse.json({ error: "song_id is required" }, { status: 400 });

  const playlists = await queryD1<{ id: string }>("SELECT id FROM playlists WHERE id = ? AND created_by = ? LIMIT 1", [id, session.user.email]);
  if (!playlists.length) return NextResponse.json({ error: "Playlist not found" }, { status: 404 });

  const songs = await queryD1<{ id: string }>("SELECT id FROM songs WHERE id = ? LIMIT 1", [body.song_id]);
  if (!songs.length) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  await queryD1(
    "INSERT OR REPLACE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, COALESCE(?, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_songs WHERE playlist_id = ?)))",
    [id, body.song_id, body.position ?? null, id]
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasD1Config()) return NextResponse.json({ error: "D1 is not configured" }, { status: 501 });

  const { id } = await params;
  const url = new URL(request.url);
  const songId = url.searchParams.get("song_id");
  if (!songId) return NextResponse.json({ error: "song_id is required" }, { status: 400 });

  const playlists = await queryD1<{ id: string }>("SELECT id FROM playlists WHERE id = ? AND created_by = ? LIMIT 1", [id, session.user.email]);
  if (!playlists.length) return NextResponse.json({ error: "Playlist not found" }, { status: 404 });

  await queryD1("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", [id, songId]);
  return NextResponse.json({ ok: true });
}
