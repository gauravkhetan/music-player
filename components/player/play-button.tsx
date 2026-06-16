"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/components/player/player-store";
import type { Song } from "@/types/music";

type PlayButtonProps = {
  songs: Song[];
  index?: number;
  label?: string;
};

export function PlayButton({ songs, index = 0, label = "Play" }: PlayButtonProps) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  return (
    <Button variant="primary" onClick={() => playQueue(songs, index)}>
      <Play className="h-4 w-4 fill-current" />
      {label}
    </Button>
  );
}
