import { notFound } from "next/navigation";
import { CoverArt } from "@/components/ui/cover-art";
import { SongList } from "@/components/song-list";
import { getAlbum, getAlbumSongs } from "@/lib/db";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [album, songs] = await Promise.all([getAlbum(id), getAlbumSongs(id)]);
  if (!album) notFound();
  return (
    <div className="space-y-0 sm:space-y-6">
      <header className="hidden flex-col gap-5 sm:flex sm:flex-row sm:items-end">
        <CoverArt src={album.cover_url} alt={album.title} className="h-44 w-44 sm:h-56 sm:w-56" priority />
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Album</p>
          <h1 className="text-4xl font-black leading-tight sm:text-6xl">{album.title}</h1>
          <p className="mt-2 text-muted">{album.year ?? "Unknown year"} · {songs.length} songs</p>
        </div>
      </header>
      <p className="mb-3 text-xl font-black sm:hidden">
        {album.title} · {songs.length.toLocaleString()} songs
      </p>
      <SongList songs={songs} />
    </div>
  );
}
