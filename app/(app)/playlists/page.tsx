import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { PlaylistManager } from "@/components/playlists/playlist-manager";
import { getPlaylists } from "@/lib/db";

export default async function PlaylistsPage() {
  const session = await auth();
  const playlists = await getPlaylists(session?.user?.email ?? "");
  return (
    <div className="sm:space-y-5">
      <PageHeader
        eyebrow="Playlists"
        title="Playlists"
        description="Create, rename, delete, and fill playlists from your library."
      />
      <p className="mb-3 text-xl font-black sm:hidden">
        Playlists · {playlists.length.toLocaleString()} playlists
      </p>
      <PlaylistManager initialPlaylists={playlists} />
    </div>
  );
}
