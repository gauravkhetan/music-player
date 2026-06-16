import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSong } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const song = await getSong(id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ song });
}
