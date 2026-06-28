import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSong, updateSongDuration } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const song = await getSong(id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ song });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { duration?: unknown } | null;
  const duration = typeof payload?.duration === "number" ? Math.round(payload.duration) : NaN;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60) {
    return NextResponse.json({ error: "Duration must be a positive number of seconds" }, { status: 400 });
  }

  const song = await getSong(id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await updateSongDuration(id, duration);
  return NextResponse.json({ duration });
}
