import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SongList } from "@/components/song-list";
import { getArtist, getArtistSongs } from "@/lib/db";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, songs] = await Promise.all([getArtist(id), getArtistSongs(id)]);
  if (!artist) notFound();
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Artist" title={artist.name} description={`${songs.length.toLocaleString()} songs`} />
      <p className="mb-4 pt-1 text-xl font-black sm:hidden">
        {artist.name} · {songs.length.toLocaleString()} songs
      </p>
      <SongList songs={songs} />
    </div>
  );
}
