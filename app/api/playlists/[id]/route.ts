import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasD1Config, queryD1 } from "@/lib/d1";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasD1Config()) return NextResponse.json({ error: "D1 is not configured" }, { status: 501 });

  const { id } = await params;
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });

  await queryD1("UPDATE playlists SET name = ? WHERE id = ? AND created_by = ?", [name, id, session.user.email]);
  return NextResponse.json({ id, name });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasD1Config()) return NextResponse.json({ error: "D1 is not configured" }, { status: 501 });

  const { id } = await params;
  await queryD1("DELETE FROM playlist_songs WHERE playlist_id = ?", [id]);
  await queryD1("DELETE FROM playlists WHERE id = ? AND created_by = ?", [id, session.user.email]);
  return NextResponse.json({ ok: true });
}
