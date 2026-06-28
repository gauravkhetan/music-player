import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { SongList } from "@/components/song-list";
import { getFavorites } from "@/lib/db";

export default async function FavoritesPage() {
  const session = await auth();
  const songs = await getFavorites(session?.user?.email ?? "");
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Favorites" title="Liked songs" description={`${songs.length.toLocaleString()} saved songs.`} />
      <p className="mb-3 text-xl font-black sm:hidden">
        Favorites · {songs.length.toLocaleString()} saved songs
      </p>
      <SongList songs={songs} removeOnUnlike />
    </div>
  );
}
