"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { SongList } from "@/components/song-list";
import type { Song, SortKey } from "@/types/music";

type SearchableLibraryProps = {
  songs: Song[];
};

export function SearchableLibrary({ songs }: SearchableLibraryProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("title");
  const [visibleCount, setVisibleCount] = useState(100);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const fuse = useMemo(() => new Fuse(songs, { keys: ["title", "artist", "album"], threshold: 0.35, ignoreLocation: true }), [songs]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setVisibleCount(100);
  }, [debouncedQuery, sort]);

  const results = useMemo(() => {
    const source = debouncedQuery.trim() ? fuse.search(debouncedQuery.trim()).map((item) => item.item) : songs;
    return [...source].sort((a, b) => {
      if (sort === "created_at") return b.created_at.localeCompare(a.created_at);
      return String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""));
    });
  }, [debouncedQuery, fuse, songs, sort]);

  const visibleSongs = results.slice(0, visibleCount);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || visibleCount >= results.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => Math.min(count + 100, results.length));
    }, { rootMargin: "600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [results.length, visibleCount]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            className="h-12 w-full rounded-md border border-border bg-surface pl-11 pr-4 text-base text-white outline-none transition placeholder:text-muted focus:border-accent"
            placeholder="Search title, artist, album"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select className="h-12 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-accent" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="created_at">Recently added</option>
        </select>
      </div>
      <SongList songs={visibleSongs} />
      <div ref={loadMoreRef} className="h-2" aria-hidden />
    </div>
  );
}
