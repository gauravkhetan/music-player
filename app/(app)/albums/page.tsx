import { PageHeader } from "@/components/page-header";
import { PaginatedCardGrid } from "@/components/paginated-card-grid";
import { getAlbumCount, getAlbums } from "@/lib/db";

const PAGE_SIZE = 20;

export default async function AlbumsPage() {
  const [albums, albumCount] = await Promise.all([
    getAlbums({ limit: PAGE_SIZE + 1 }),
    getAlbumCount()
  ]);
  const initialAlbums = albums.slice(0, PAGE_SIZE);
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Albums" title="Albums" description="Browse albums from your personal collection." />
      <p className="mb-4 pt-1 text-xl font-black sm:hidden">
        Albums · {albumCount.toLocaleString()} albums
      </p>
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
