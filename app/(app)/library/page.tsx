import { PageHeader } from "@/components/page-header";
import { SearchableLibrary } from "@/components/searchable-library";
import { getSongCount, getSongs } from "@/lib/db";

const PAGE_SIZE = 20;

export default async function LibraryPage() {
  const [songs, songCount] = await Promise.all([
    getSongs({ limit: PAGE_SIZE + 1, sort: "title" }),
    getSongCount()
  ]);
  const initialSongs = songs.slice(0, PAGE_SIZE);
  return (
    <div className="space-y-0 sm:space-y-5">
      <PageHeader eyebrow="Library" title="All songs" description="Search, sort, and stream your personal collection." />
      <p className="mb-3 text-xl font-black sm:hidden">
        Library · {songCount.toLocaleString()} songs
      </p>
      <SearchableLibrary initialSongs={initialSongs} initialHasMore={songs.length > PAGE_SIZE} pageSize={PAGE_SIZE} />
    </div>
  );
}
