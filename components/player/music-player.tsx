"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { queue, currentIndex, currentSong, isPlaying, volume, repeat, shuffle, setPlaying, setVolume, playQueue, next, previous, toggleShuffle, cycleRepeat } = usePlayerStore();

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
    return null;
  }

  function seekTo(time: number) {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function stopPlayerOpen(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded(true);
          }
        }}
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 cursor-pointer border-t border-border bg-[#121212]/95 px-3 py-3 shadow-player backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:bottom-0 lg:left-60 lg:px-6 lg:py-5"
        aria-label={`Open player for ${currentSong.title}`}
      >
        <audio
          ref={audioRef}
          preload="metadata"
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => {
            setPlaying(false);
            setAudioError("Audio stream failed");
          }}
          onEnded={() => next()}
        />
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 lg:min-h-[88px] lg:grid-cols-[minmax(220px,1fr)_minmax(360px,1.3fr)_minmax(180px,1fr)]">
          <div className="flex min-w-0 items-center gap-3">
            <CoverArt src={currentSong.cover_url} alt={currentSong.album} className="h-12 w-12 lg:h-16 lg:w-16" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{currentSong.title}</p>
              <p className="truncate text-xs text-muted">{audioError ?? currentSong.artist}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2" onClick={stopPlayerOpen} onKeyDown={stopPlayerOpen}>
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
              <Button size="icon" variant="ghost" onClick={() => next(true)} aria-label="Next" title="Next">
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
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label="Seek"
              />
              <span className="w-10">{formatDuration(duration)}</span>
            </div>
          </div>
          <div className="hidden items-center justify-end gap-2 lg:flex" onClick={stopPlayerOpen} onKeyDown={stopPlayerOpen}>
            <Volume2 className="h-5 w-5 text-muted" />
            <input className="w-28 accent-accent" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" />
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-background px-4 pb-8 pt-[calc(env(safe-area-inset-top)+16px)] text-white sm:px-6 lg:left-60 lg:px-10" role="dialog" aria-modal="true" aria-label="Now playing">
          <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Now playing</p>
                <p className="mt-1 text-sm text-muted">{currentIndex + 1 > 0 ? `${currentIndex + 1} of ${queue.length}` : `${queue.length} songs in queue`}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsExpanded(false)} aria-label="Close full screen player" title="Close">
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>

            <section className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-center">
              <CoverArt src={currentSong.cover_url} alt={currentSong.album} className="mx-auto aspect-square w-full max-w-[420px]" priority />
              <div className="min-w-0 space-y-5">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-black leading-tight sm:text-4xl">{currentSong.title}</h2>
                  <p className="mt-2 truncate text-base text-muted">{audioError ?? currentSong.artist}</p>
                  <p className="mt-1 truncate text-sm text-muted">{currentSong.album}</p>
                </div>

                <div className="space-y-2">
                  <input
                    className="h-1 w-full accent-accent"
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    aria-label="Seek"
                  />
                  <div className="flex justify-between text-xs text-muted">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Button size="icon" variant="ghost" onClick={toggleShuffle} aria-label="Shuffle" title="Shuffle">
                    <Shuffle className={cn("h-5 w-5", shuffle && "text-accent")} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={previous} aria-label="Previous" title="Previous">
                    <SkipBack className="h-6 w-6" />
                  </Button>
                  <Button className="h-14 w-14 rounded-full" size="icon" variant="primary" onClick={() => setPlaying(!isPlaying)} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => next(true)} aria-label="Next" title="Next">
                    <SkipForward className="h-6 w-6" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={cycleRepeat} aria-label="Repeat" title="Repeat">
                    {repeat === "one" ? <Repeat1 className="h-5 w-5 text-accent" /> : <Repeat className={cn("h-5 w-5", repeat === "all" && "text-accent")} />}
                  </Button>
                </div>

                <div className="hidden items-center justify-center gap-3 lg:flex">
                  <Volume2 className="h-5 w-5 text-muted" />
                  <input className="w-44 accent-accent" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Queue</h3>
                <p className="text-sm text-muted">{queue.length.toLocaleString()} songs</p>
              </div>
              <div className="overflow-hidden rounded-md border border-border bg-surface">
                {queue.map((song, index) => {
                  const isCurrent = index === currentIndex;
                  return (
                    <button
                      key={`${song.id}-${index}`}
                      type="button"
                      onClick={() => playQueue(queue, index)}
                      className={cn(
                        "grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.04]",
                        isCurrent && "bg-white/[0.06]"
                      )}
                    >
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-bold", isCurrent ? "text-accent" : "text-white")}>{song.title}</span>
                        <span className="block truncate text-xs text-muted">{song.artist} · {song.album}</span>
                      </span>
                      <span className="text-xs text-muted">{formatDuration(song.duration)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
