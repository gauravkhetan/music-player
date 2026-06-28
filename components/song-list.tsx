"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, ListPlus, X } from "lucide-react";
import type { Playlist, Song } from "@/types/music";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/ui/cover-art";
import { usePlayerStore } from "@/components/player/player-store";
import { cn, formatDuration } from "@/lib/utils";

type SongListProps = {
  songs: Song[];
  compact?: boolean;
  showCompactArtworkOnDesktop?: boolean;
  hidePlaylistAction?: boolean;
  removeOnUnlike?: boolean;
};

export function SongList({ songs, compact, showCompactArtworkOnDesktop, hidePlaylistAction, removeOnUnlike }: SongListProps) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [playlistStatus, setPlaylistStatus] = useState<string | null>(null);
  const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null);
  const [visibleSongs, setVisibleSongs] = useState(songs);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const requestedDurationIds = useRef<Set<string>>(new Set());
  const queueSongs = useMemo(() => visibleSongs, [visibleSongs]);

  useEffect(() => {
    setVisibleSongs(songs);
  }, [songs]);

  useEffect(() => {
    let cancelled = false;
    async function loadActionsData() {
      const [favoritesResponse, playlistsResponse] = await Promise.all([
        fetch("/api/favorites", { cache: "no-store" }),
        fetch("/api/playlists", { cache: "no-store" })
      ]);

      if (favoritesResponse.ok) {
        const payload = (await favoritesResponse.json()) as { song_ids?: string[] };
        if (!cancelled) setFavoriteIds(new Set(payload.song_ids ?? []));
      }

      if (playlistsResponse.ok) {
        const payload = (await playlistsResponse.json()) as { playlists?: Playlist[] };
        if (!cancelled) setPlaylists(payload.playlists ?? []);
      }
    }
    void loadActionsData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missingSongs = visibleSongs
      .filter((song) => !song.duration && !durations[song.id] && !requestedDurationIds.current.has(song.id))
      .slice(0, 20);
    if (!missingSongs.length) return;
    for (const song of missingSongs) requestedDurationIds.current.add(song.id);

    async function loadDuration(song: Song) {
      const response = await fetch(`/api/songs/${encodeURIComponent(song.id)}/stream-url`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { url?: string };
      if (!payload.url || cancelled) return;
      const url = payload.url;

      const duration = await new Promise<number | null>((resolve) => {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          const seconds = Math.round(audio.duration);
          resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
          audio.removeAttribute("src");
          audio.load();
        };
        audio.onerror = () => resolve(null);
        audio.src = url;
      });

      if (!duration || cancelled) return;
      setDurations((current) => ({ ...current, [song.id]: duration }));
      void fetch(`/api/songs/${encodeURIComponent(song.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration })
      });
    }

    void Promise.all(missingSongs.map((song) => loadDuration(song)));
    return () => {
      cancelled = true;
    };
  }, [durations, visibleSongs]);

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

  async function addSongToPlaylist(playlist: Playlist) {
    if (!playlistSong) return;
    setAddingPlaylistId(playlist.id);
    setPlaylistStatus(null);

    const response = await fetch(`/api/playlists/${playlist.id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_id: playlistSong.id })
    });

    setAddingPlaylistId(null);
    if (!response.ok) {
      setPlaylistStatus("Could not add song");
      return;
    }

    setPlaylistStatus(`Added to ${playlist.name}`);
    window.setTimeout(() => {
      setPlaylistSong(null);
      setPlaylistStatus(null);
    }, 800);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {visibleSongs.map((song, index) => {
        const isFavorite = favoriteIds.has(song.id);
        const duration = song.duration ?? durations[song.id] ?? null;
        const durationLabel = duration ? formatDuration(duration) : "...";
        return (
        <div
          key={`${song.id}-${index}`}
          role="button"
          tabIndex={0}
          onClick={() => playQueue(queueSongs, index)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              playQueue(queueSongs, index);
            }
          }}
          className="grid min-h-[68px] cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[1fr_1fr_80px_auto]"
          aria-label={`Play ${song.title}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {!compact ? <CoverArt src={song.cover_url} alt={song.album} className="hidden h-11 w-11 sm:grid" /> : null}
            {compact && showCompactArtworkOnDesktop ? <CoverArt src={song.cover_url} alt={song.album} className="hidden h-11 w-11 sm:grid" /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{song.title}</p>
              <p className="truncate text-xs text-muted sm:hidden">
                {song.artist} · {song.album} · {durationLabel}
              </p>
              <p className="hidden truncate text-xs text-muted sm:block">{song.artist}</p>
            </div>
          </div>
          <p className="hidden min-w-0 truncate text-sm text-muted sm:block">{song.album}</p>
          <p className="hidden text-right text-sm text-muted sm:block">{durationLabel}</p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); void toggleFavorite(song); }} onKeyDown={(event) => event.stopPropagation()} aria-label={isFavorite ? `Unlike ${song.title}` : `Like ${song.title}`} title={isFavorite ? "Unlike" : "Like"}>
              <Heart className={cn("h-5 w-5", isFavorite && "fill-accent text-accent")} />
            </Button>
            {!hidePlaylistAction ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setPlaylistSong(song);
                  setPlaylistStatus(null);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label={`Add ${song.title} to playlist`}
                title="Add to playlist"
              >
                <ListPlus className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        </div>
        );
      })}
      {playlistSong ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Add ${playlistSong.title} to playlist`}>
          <div className="w-full max-w-sm rounded-md border border-border bg-surface p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Add to playlist</p>
                <h2 className="mt-1 truncate text-lg font-black text-white">{playlistSong.title}</h2>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setPlaylistSong(null)} aria-label="Close playlist picker" title="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {playlists.length ? playlists.map((playlist) => (
                <Button
                  key={playlist.id}
                  variant="surface"
                  className="w-full justify-between"
                  disabled={addingPlaylistId === playlist.id}
                  onClick={() => void addSongToPlaylist(playlist)}
                >
                  <span className="truncate">{playlist.name}</span>
                  <span className="shrink-0 text-xs text-muted">{playlist.song_count ?? 0} songs</span>
                </Button>
              )) : (
                <p className="rounded-md bg-white/5 p-3 text-sm text-muted">Create a playlist first, then come back here.</p>
              )}
            </div>

            {playlistStatus ? <p className="mt-3 text-sm text-muted">{playlistStatus}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
