import { auth } from "@/auth";
import { CardGrid } from "@/components/card-grid";
import { PageHeader } from "@/components/page-header";
import { PlayButton } from "@/components/player/play-button";
import { SongList } from "@/components/song-list";
import { getAlbums, getFavorites, getPlaylists, getRecentlyAddedSongs, getRecentlyPlayed } from "@/lib/db";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const [recentlyPlayed, favorites, playlists, recentlyAdded, albums] = await Promise.all([
    getRecentlyPlayed(email),
    getFavorites(email),
    getPlaylists(email),
    getRecentlyAddedSongs(),
    getAlbums()
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Private library"
        title="Listen now"
        description="Recently played, saved tracks, playlists, and newly imported songs from your personal collection."
        action={<PlayButton songs={recentlyAdded} label="Play recent" />}
      />
      <section className="space-y-3">
        <h2 className="text-xl font-black">Recently played</h2>
        <SongList songs={recentlyPlayed.length ? recentlyPlayed.slice(0, 8) : recentlyAdded.slice(0, 8)} compact />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-black">Quick access playlists</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="rounded-md bg-surface p-4">
              <p className="font-bold">{playlist.name}</p>
              <p className="mt-1 text-sm text-muted">{playlist.song_count ?? 0} songs</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-black">Favorites</h2>
        <SongList songs={favorites.slice(0, 6)} compact />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-black">Recently added albums</h2>
        <CardGrid items={albums.slice(0, 10).map((album) => ({ id: album.id, href: `/albums/${album.id}`, title: album.title, subtitle: album.artist, image_url: album.cover_url }))} />
      </section>
    </div>
  );
}
