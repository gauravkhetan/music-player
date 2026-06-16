import { PageHeader } from "@/components/page-header";
import { SearchableLibrary } from "@/components/searchable-library";
import { getSongs } from "@/lib/db";

export default async function LibraryPage() {
  const songs = await getSongs({ limit: 5000, sort: "title" });
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Library" title="All songs" description={`${songs.length.toLocaleString()} songs ready to stream directly from R2.`} />
      <SearchableLibrary songs={songs} />
    </div>
  );
}
