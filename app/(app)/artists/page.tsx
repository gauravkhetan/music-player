import { PageHeader } from "@/components/page-header";
import { PaginatedCardGrid } from "@/components/paginated-card-grid";
import { getArtists } from "@/lib/db";

const PAGE_SIZE = 20;

export default async function ArtistsPage() {
  const artists = await getArtists({ limit: PAGE_SIZE + 1 });
  const initialArtists = artists.slice(0, PAGE_SIZE);
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Artists" title="Artists" description="Browse artists from your personal collection." />
      <PaginatedCardGrid
        initialItems={initialArtists.map((artist) => ({ id: artist.id, href: `/artists/${artist.id}`, title: artist.name, subtitle: `${artist.song_count ?? 0} songs`, image_url: artist.image_url }))}
        initialHasMore={artists.length > PAGE_SIZE}
        endpoint="/api/artists"
        payloadKey="artists"
        itemType="artist"
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
