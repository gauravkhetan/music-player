import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSong } from "@/lib/db";
import { createSignedAudioUrl, getObjectKeyFromSong } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const song = await getSong(id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = await createSignedAudioUrl(song);
    return NextResponse.json({ url, key: getObjectKeyFromSong(song), expires_in: 3600 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign R2 URL" }, { status: 500 });
  }
}
