"use client";

import { useState } from "react";
import { ListPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Playlist } from "@/types/music";

export function PlaylistManager({ initialPlaylists }: { initialPlaylists: Playlist[] }) {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [name, setName] = useState("");

  async function createPlaylist() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const response = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed })
    });
    if (response.ok) {
      const playlist = (await response.json()) as Playlist;
      setPlaylists((current) => [{ ...playlist, song_count: 0 }, ...current]);
      setName("");
    }
  }

  async function renamePlaylist(playlist: Playlist) {
    const nextName = window.prompt("Rename playlist", playlist.name)?.trim();
    if (!nextName || nextName === playlist.name) return;
    const response = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName })
    });
    if (response.ok) {
      setPlaylists((current) => current.map((item) => (item.id === playlist.id ? { ...item, name: nextName } : item)));
    }
  }

  async function deletePlaylist(playlist: Playlist) {
    if (!window.confirm(`Delete ${playlist.name}?`)) return;
    const response = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
    if (response.ok) {
      setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="h-12 rounded-md border border-border bg-surface px-4 text-base text-white outline-none placeholder:text-muted focus:border-accent"
          placeholder="New playlist name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button variant="primary" onClick={createPlaylist}>
          <ListPlus className="h-4 w-4" />
          Create
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((playlist) => (
          <article key={playlist.id} className="rounded-md bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-bold">{playlist.name}</h2>
                <p className="mt-1 text-sm text-muted">{playlist.song_count ?? 0} songs</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => renamePlaylist(playlist)} aria-label={`Rename ${playlist.name}`} title="Rename">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deletePlaylist(playlist)} aria-label={`Delete ${playlist.name}`} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
