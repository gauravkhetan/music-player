import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { SongList } from "@/components/song-list";
import { getPlaylist, getPlaylistSongs } from "@/lib/db";

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const { id } = await params;
  const [playlist, songs] = await Promise.all([
    getPlaylist(id, email),
    getPlaylistSongs(id, email)
  ]);

  if (!playlist) notFound();

  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader
        eyebrow="Playlist"
        title={playlist.name}
        description={`${songs.length.toLocaleString()} songs`}
      />
      {songs.length ? (
        <SongList songs={songs} hidePlaylistAction />
      ) : (
        <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">This playlist is empty. Add songs from your library with the list-plus button.</p>
      )}
    </div>
  );
}
