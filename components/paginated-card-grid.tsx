"use client";

import { useEffect, useRef, useState } from "react";
import { CardGrid, type GridItem } from "@/components/card-grid";
import type { Album, Artist } from "@/types/music";

type PaginatedCardGridProps = {
  initialItems: GridItem[];
  initialHasMore: boolean;
  endpoint: string;
  payloadKey: "albums" | "artists";
  itemType: "album" | "artist";
  pageSize?: number;
};

type CardsResponse = {
  albums?: Album[];
  artists?: Artist[];
  has_more?: boolean;
};

function toGridItems(payload: CardsResponse, itemType: "album" | "artist") {
  if (itemType === "album") {
    return (payload.albums ?? []).map((album) => ({
      id: album.id,
      href: `/albums/${album.id}`,
      title: album.title,
      subtitle: `${album.song_count ?? 0} songs`,
      image_url: album.cover_url
    }));
  }

  return (payload.artists ?? []).map((artist) => ({
    id: artist.id,
    href: `/artists/${artist.id}`,
    title: artist.name,
    subtitle: `${artist.song_count ?? 0} songs`,
    image_url: artist.image_url
  }));
}

export function PaginatedCardGrid({ initialItems, initialHasMore, endpoint, payloadKey, itemType, pageSize = 20 }: PaginatedCardGridProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setIsLoading(true);

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(items.length)
      });

      void fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load ${payloadKey}`);
          return response.json() as Promise<CardsResponse>;
        })
        .then((payload) => {
          setItems((current) => [...current, ...toGridItems(payload, itemType)]);
          setHasMore(Boolean(payload.has_more));
        })
        .catch((error) => console.error(error))
        .finally(() => setIsLoading(false));
    }, { rootMargin: "600px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, [endpoint, hasMore, isLoading, itemType, items.length, pageSize, payloadKey]);

  return (
    <div className="space-y-4">
      <CardGrid items={items} />
      <div ref={loadMoreRef} className="flex min-h-10 items-center justify-center text-sm text-muted" aria-live="polite">
        {isLoading ? "Loading..." : hasMore ? null : items.length ? "End of list" : "Nothing found"}
      </div>
    </div>
  );
}
