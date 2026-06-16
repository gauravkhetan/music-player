"use client";

import { create } from "zustand";
import type { Song } from "@/types/music";

type RepeatMode = "off" | "one" | "all";

type PlayerState = {
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  setPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentSong: null,
  isPlaying: false,
  volume: 0.85,
  shuffle: false,
  repeat: "off",
  setPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  playQueue: (songs, startIndex = 0) => {
    const currentSong = songs[startIndex] ?? null;
    set({ queue: songs, currentIndex: currentSong ? startIndex : -1, currentSong, isPlaying: Boolean(currentSong) });
  },
  addToQueue: (song) => {
    const { queue, currentSong } = get();
    const nextQueue = [...queue, song];
    set({
      queue: nextQueue,
      currentSong: currentSong ?? song,
      currentIndex: currentSong ? get().currentIndex : 0,
      isPlaying: currentSong ? get().isPlaying : true
    });
  },
  next: () => {
    const { queue, currentIndex, shuffle, repeat } = get();
    if (!queue.length) return;
    if (repeat === "one") {
      set({ isPlaying: true });
      return;
    }
    const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === "all") set({ currentIndex: 0, currentSong: queue[0], isPlaying: true });
      else set({ isPlaying: false });
      return;
    }
    set({ currentIndex: nextIndex, currentSong: queue[nextIndex], isPlaying: true });
  },
  previous: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const previousIndex = Math.max(currentIndex - 1, 0);
    set({ currentIndex: previousIndex, currentSong: queue[previousIndex], isPlaying: true });
  },
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  cycleRepeat: () => set((state) => ({ repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off" }))
}));
