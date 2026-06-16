import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PlayButton } from "@/components/player/play-button";
import { SongList } from "@/components/song-list";
import { getArtist, getArtistSongs } from "@/lib/db";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, songs] = await Promise.all([getArtist(id), getArtistSongs(id)]);
  if (!artist) notFound();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Artist" title={artist.name} description={`${songs.length.toLocaleString()} songs`} action={<PlayButton songs={songs} label="Play artist" />} />
      <SongList songs={songs} />
    </div>
  );
}
