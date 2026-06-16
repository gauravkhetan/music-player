import { CardGrid } from "@/components/card-grid";
import { PageHeader } from "@/components/page-header";
import { getArtists } from "@/lib/db";

export default async function ArtistsPage() {
  const artists = await getArtists();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Artists" title="Artists" description={`${artists.length.toLocaleString()} artists in your library.`} />
      <CardGrid items={artists.map((artist) => ({ id: artist.id, href: `/artists/${artist.id}`, title: artist.name, subtitle: `${artist.song_count ?? 0} songs`, image_url: artist.image_url }))} />
    </div>
  );
}
