import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getArtists } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ artists: await getArtists() });
}
