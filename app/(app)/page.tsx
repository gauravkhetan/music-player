import { auth } from "@/auth";
import Link from "next/link";
import { CardGrid } from "@/components/card-grid";
import { PageHeader } from "@/components/page-header";
import { SongList } from "@/components/song-list";
import { getAlbums, getFavorites, getPlaylists, getRecentlyAddedSongs, getRecentlyPlayed } from "@/lib/db";
import type { Song } from "@/types/music";

function uniqueSongs(songs: Song[]) {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const [recentlyPlayed, favorites, playlists, recentlyAdded, albums] = await Promise.all([
    getRecentlyPlayed(email),
    getFavorites(email),
    getPlaylists(email),
    getRecentlyAddedSongs(),
    getAlbums({ limit: 10 })
  ]);
  const recentSongs = uniqueSongs(recentlyPlayed);

  return (
    <div className="space-y-7 sm:space-y-8">
      <PageHeader
        eyebrow="Private library"
        title="Listen now"
        description="Recently played, saved tracks, playlists, and newly imported songs from your personal collection."
      />
      <section className="space-y-3">
        <h2 className="text-xl font-black">Recently played</h2>
        <SongList songs={recentSongs.length ? recentSongs.slice(0, 8) : recentlyAdded.slice(0, 8)} compact showCompactArtworkOnDesktop />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-black">Quick access playlists</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="rounded-md bg-surface p-4 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <p className="font-bold">{playlist.name}</p>
              <p className="mt-1 text-sm text-muted">{playlist.song_count ?? 0} songs</p>
            </Link>
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
