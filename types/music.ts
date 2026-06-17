export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  duration: number | null;
  cover_url: string | null;
  audio_url: string;
  source_key?: string | null;
  track_number: number | null;
  year: number | null;
  metadata_source?: string | null;
  metadata_confidence?: "high" | "medium" | "low" | "unmatched" | null;
  metadata_review?: string | null;
  enriched_at?: string | null;
  created_at: string;
};

export type Artist = {
  id: string;
  name: string;
  image_url: string | null;
  song_count?: number;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  year: number | null;
  song_count?: number;
};

export type Playlist = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  song_count?: number;
};

export type SortKey = "title" | "artist" | "album" | "created_at";
