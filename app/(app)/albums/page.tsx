import { CardGrid } from "@/components/card-grid";
import { PageHeader } from "@/components/page-header";
import { getAlbums } from "@/lib/db";

export default async function AlbumsPage() {
  const albums = await getAlbums();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Albums" title="Albums" description={`${albums.length.toLocaleString()} albums available.`} />
      <CardGrid items={albums.map((album) => ({ id: album.id, href: `/albums/${album.id}`, title: album.title, subtitle: `${album.song_count ?? 0} songs`, image_url: album.cover_url }))} />
    </div>
  );
}
