"use client";

import { useEffect, useRef, useState } from "react";
import { ListPlus, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/ui/cover-art";
import { usePlayerStore } from "@/components/player/player-store";
import { cn, formatDuration } from "@/lib/utils";

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const signedSongIdRef = useRef<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const { currentSong, isPlaying, volume, repeat, shuffle, setPlaying, setVolume, next, previous, toggleShuffle, cycleRepeat } = usePlayerStore();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    let cancelled = false;

    async function prepareAndPlay() {
      if (!audio || !currentSong) return;

      if (!isPlaying) {
        audio.pause();
        return;
      }

      try {
        setAudioError(null);
        if (signedSongIdRef.current !== currentSong.id || !audio.src) {
          const response = await fetch(`/api/songs/${encodeURIComponent(currentSong.id)}/stream-url`, { cache: "no-store" });
          if (!response.ok) throw new Error("Could not prepare audio stream");
          const payload = (await response.json()) as { url: string };
          if (cancelled) return;
          audio.src = payload.url;
          signedSongIdRef.current = currentSong.id;
          setCurrentTime(0);
        }
        await audio.play();
        void fetch("/api/recently-played", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song_id: currentSong.id })
        });
      } catch (error) {
        if (cancelled) return;
        signedSongIdRef.current = null;
        setPlaying(false);
        setAudioError(error instanceof Error ? error.message : "Audio could not start");
      }
    }

    void prepareAndPlay();
    return () => {
      cancelled = true;
    };
  }, [currentSong, isPlaying, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  if (!currentSong) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[#121212]/95 px-4 py-3 shadow-player backdrop-blur safe-bottom lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-sm text-muted">
          <span>Select a song to start listening</span>
          <ListPlus className="h-5 w-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[#121212]/95 px-3 py-3 shadow-player backdrop-blur safe-bottom lg:left-60">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => {
          setPlaying(false);
          setAudioError("Audio stream failed");
        }}
        onEnded={next}
      />
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(360px,1.3fr)_minmax(180px,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <CoverArt src={currentSong.cover_url} alt={currentSong.album} className="h-12 w-12" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{currentSong.title}</p>
            <p className="truncate text-xs text-muted">{audioError ?? currentSong.artist}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggleShuffle} aria-label="Shuffle" title="Shuffle">
              <Shuffle className={cn("h-5 w-5", shuffle && "text-accent")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={previous} aria-label="Previous" title="Previous">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="primary" onClick={() => setPlaying(!isPlaying)} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={next} aria-label="Next" title="Next">
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={cycleRepeat} aria-label="Repeat" title="Repeat">
              {repeat === "one" ? <Repeat1 className="h-5 w-5 text-accent" /> : <Repeat className={cn("h-5 w-5", repeat === "all" && "text-accent")} />}
            </Button>
          </div>
          <div className="hidden w-full items-center gap-2 text-[11px] text-muted sm:flex">
            <span className="w-10 text-right">{formatDuration(currentTime)}</span>
            <input
              className="h-1 w-full accent-accent"
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(event) => {
                const time = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = time;
                setCurrentTime(time);
              }}
              aria-label="Seek"
            />
            <span className="w-10">{formatDuration(duration)}</span>
          </div>
        </div>
        <div className="hidden items-center justify-end gap-2 lg:flex">
          <Volume2 className="h-5 w-5 text-muted" />
          <input className="w-28 accent-accent" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" />
        </div>
      </div>
    </div>
  );
}
