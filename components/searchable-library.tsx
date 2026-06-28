"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SongList } from "@/components/song-list";
import type { Song, SortKey } from "@/types/music";

type SearchableLibraryProps = {
  initialSongs: Song[];
  initialHasMore: boolean;
  pageSize?: number;
};

type SongsResponse = {
  songs: Song[];
  has_more?: boolean;
};

export function SearchableLibrary({ initialSongs, initialHasMore, pageSize = 20 }: SearchableLibraryProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("title");
  const [songs, setSongs] = useState(initialSongs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const hasMountedRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryKey = useMemo(() => `${debouncedQuery.trim()}::${sort}`, [debouncedQuery, sort]);

  const fetchSongs = useCallback(async (offset: number, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      sort
    });
    const trimmedQuery = debouncedQuery.trim();
    if (trimmedQuery) params.set("q", trimmedQuery);

    const response = await fetch(`/api/songs?${params.toString()}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Could not load songs");
    return (await response.json()) as SongsResponse;
  }, [debouncedQuery, pageSize, sort]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    void fetchSongs(0, controller.signal)
      .then((payload) => {
        setSongs(payload.songs);
        setHasMore(Boolean(payload.has_more));
      })
      .catch((error) => {
        if (error.name !== "AbortError") console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [fetchSongs, queryKey]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || isLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setIsLoading(true);
      void fetchSongs(songs.length)
        .then((payload) => {
          setSongs((current) => [...current, ...payload.songs]);
          setHasMore(Boolean(payload.has_more));
        })
        .catch((error) => console.error(error))
        .finally(() => setIsLoading(false));
    }, { rootMargin: "600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchSongs, hasMore, isLoading, queryKey, songs.length]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            className="h-12 w-full min-w-0 rounded-md border border-border bg-surface pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent sm:pl-11 sm:pr-4 sm:text-base"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select className="h-12 min-w-0 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-accent" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="created_at">Recently added</option>
        </select>
      </div>
      <SongList songs={songs} />
      <div ref={loadMoreRef} className="flex min-h-10 items-center justify-center text-sm text-muted" aria-live="polite">
        {isLoading ? "Loading..." : hasMore ? null : songs.length ? "End of list" : "No songs found"}
      </div>
    </div>
  );
}
