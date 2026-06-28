import { PageHeader } from "@/components/page-header";
import { PaginatedCardGrid } from "@/components/paginated-card-grid";
import { getAlbums } from "@/lib/db";

const PAGE_SIZE = 20;

export default async function AlbumsPage() {
  const albums = await getAlbums({ limit: PAGE_SIZE + 1 });
  const initialAlbums = albums.slice(0, PAGE_SIZE);
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Albums" title="Albums" description="Browse albums from your personal collection." />
      <PaginatedCardGrid
        initialItems={initialAlbums.map((album) => ({ id: album.id, href: `/albums/${album.id}`, title: album.title, subtitle: `${album.song_count ?? 0} songs`, image_url: album.cover_url }))}
        initialHasMore={albums.length > PAGE_SIZE}
        endpoint="/api/albums"
        payloadKey="albums"
        itemType="album"
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
