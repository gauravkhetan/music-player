"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, ListPlus, Play } from "lucide-react";
import type { Song } from "@/types/music";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/ui/cover-art";
import { usePlayerStore } from "@/components/player/player-store";
import { cn, formatDuration } from "@/lib/utils";

type SongListProps = {
  songs: Song[];
  compact?: boolean;
  removeOnUnlike?: boolean;
};

export function SongList({ songs, compact, removeOnUnlike }: SongListProps) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [visibleSongs, setVisibleSongs] = useState(songs);
  const queueSongs = useMemo(() => visibleSongs, [visibleSongs]);

  useEffect(() => {
    setVisibleSongs(songs);
  }, [songs]);

  useEffect(() => {
    let cancelled = false;
    async function loadFavorites() {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { song_ids?: string[] };
      if (!cancelled) setFavoriteIds(new Set(payload.song_ids ?? []));
    }
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleFavorite(song: Song) {
    const isFavorite = favoriteIds.has(song.id);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
    if (isFavorite && removeOnUnlike) {
      setVisibleSongs((current) => current.filter((item) => item.id !== song.id));
    }

    const response = await fetch(isFavorite ? `/api/favorites?song_id=${encodeURIComponent(song.id)}` : "/api/favorites", {
      method: isFavorite ? "DELETE" : "POST",
      headers: isFavorite ? undefined : { "Content-Type": "application/json" },
      body: isFavorite ? undefined : JSON.stringify({ song_id: song.id })
    });

    if (!response.ok) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (isFavorite) next.add(song.id);
        else next.delete(song.id);
        return next;
      });
      if (isFavorite && removeOnUnlike) setVisibleSongs((current) => [song, ...current]);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {visibleSongs.map((song, index) => {
        const isFavorite = favoriteIds.has(song.id);
        return (
        <div key={song.id} className="grid min-h-[68px] grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-white/[0.04] sm:grid-cols-[auto_1fr_1fr_80px_auto]">
          <Button size="icon" variant="ghost" onClick={() => playQueue(queueSongs, index)} aria-label={`Play ${song.title}`} title="Play">
            <Play className="h-5 w-5 fill-current" />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            {!compact ? <CoverArt src={song.cover_url} alt={song.album} className="h-11 w-11" /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{song.title}</p>
              <p className="truncate text-xs text-muted sm:hidden">{song.artist} · {song.album}</p>
              <p className="hidden truncate text-xs text-muted sm:block">{song.artist}</p>
            </div>
          </div>
          <p className="hidden min-w-0 truncate text-sm text-muted sm:block">{song.album}</p>
          <p className="hidden text-right text-sm text-muted sm:block">{formatDuration(song.duration)}</p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => void toggleFavorite(song)} aria-label={isFavorite ? `Unlike ${song.title}` : `Like ${song.title}`} title={isFavorite ? "Unlike" : "Like"}>
              <Heart className={cn("h-5 w-5", isFavorite && "fill-accent text-accent")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => addToQueue(song)} aria-label={`Add ${song.title} to queue`} title="Add to queue">
              <ListPlus className="h-5 w-5" />
            </Button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
