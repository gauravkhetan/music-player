import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPlaylists } from "@/lib/db";
import { hasD1Config, queryD1 } from "@/lib/d1";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ playlists: await getPlaylists(session.user.email) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasD1Config()) return NextResponse.json({ error: "D1 is not configured" }, { status: 501 });

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await queryD1("INSERT INTO playlists (id, name, created_by, created_at) VALUES (?, ?, ?, ?)", [id, name, session.user.email, createdAt]);
  return NextResponse.json({ id, name, created_by: session.user.email, created_at: createdAt }, { status: 201 });
}
