import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { appEnv } from "@/lib/env";
import { hasD1Config, queryD1 } from "@/lib/d1";
import { slug, songHasArtist, splitArtistNames } from "@/lib/artist-utils";
import type { Album, Artist, Playlist, Song, SortKey } from "@/types/music";

type QueryOptions = {
  search?: string;
  sort?: SortKey;
  limit?: number;
  offset?: number;
};

type PageOptions = {
  limit?: number;
  offset?: number;
};

type LibraryData = {
  songs: Song[];
  playlists: Playlist[];
  playlist_songs: Array<{ playlist_id: string; song_id: string; position: number }>;
  favorites: Array<{ user_email: string; song_id: string }>;
  recently_played: Array<{ user_email: string; song_id: string; played_at: string }>;
};

const sampleDataPromise = loadSampleData();

async function loadSampleData(): Promise<LibraryData> {
  const file = path.join(process.cwd(), appEnv.localSeedPath);
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as LibraryData;
}

function sortSongs(songs: Song[], sort: SortKey = "title") {
  const copied = [...songs];
  return copied.sort((a, b) => {
    if (sort === "created_at") return b.created_at.localeCompare(a.created_at);
    return String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""));
  });
}

function filterSongs(songs: Song[], search?: string) {
  if (!search?.trim()) return songs;
  const needle = search.trim().toLowerCase();
  return songs.filter((song) =>
    [song.title, song.artist, song.album].some((value) => value.toLowerCase().includes(needle))
  );
}

function paginate<T>(items: T[], limit = 50, offset = 0) {
  return items.slice(offset, offset + limit);
}

export async function getSongs(options: QueryOptions = {}) {
  if (hasD1Config()) {
    const sortColumn = options.sort === "created_at" ? "created_at" : options.sort ?? "title";
    const search = options.search?.trim();
    const where = search ? "WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?" : "";
    const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    return queryD1<Song>(
      `SELECT * FROM songs ${where} ORDER BY ${sortColumn === "created_at" ? "created_at DESC" : `${sortColumn} COLLATE NOCASE ASC`} LIMIT ? OFFSET ?`,
      [...params, options.limit ?? 50, options.offset ?? 0]
    );
  }
  const data = await sampleDataPromise;
  const songs = sortSongs(filterSongs(data.songs, options.search), options.sort);
  return paginate(songs, options.limit, options.offset);
}

export async function getSong(id: string) {
  if (hasD1Config()) {
    const rows = await queryD1<Song>("SELECT * FROM songs WHERE id = ? LIMIT 1", [id]);
    return rows[0] ?? null;
  }
  const data = await sampleDataPromise;
  return data.songs.find((song) => song.id === id) ?? null;
}

export async function updateSongDuration(id: string, duration: number) {
  if (hasD1Config()) {
    await queryD1("UPDATE songs SET duration = ? WHERE id = ?", [duration, id]);
    return;
  }
  const data = await sampleDataPromise;
  const song = data.songs.find((item) => item.id === id);
  if (song) song.duration = duration;
}

export async function getArtists(options: PageOptions = {}): Promise<Artist[]> {
  if (hasD1Config()) {
    if (options.limit) {
      return queryD1<Artist>(
        `WITH page AS (
           SELECT id, name, image_url
           FROM artists
           ORDER BY name COLLATE NOCASE
           LIMIT ? OFFSET ?
         )
         SELECT page.id,
                page.name,
                page.image_url,
                (
                  SELECT COUNT(*)
                  FROM songs
                  WHERE REPLACE(songs.artist, ', ', ',') = page.name
                     OR REPLACE(songs.artist, ', ', ',') LIKE page.name || ',%'
                     OR REPLACE(songs.artist, ', ', ',') LIKE '%,' || page.name
                     OR REPLACE(songs.artist, ', ', ',') LIKE '%,' || page.name || ',%'
                ) AS song_count
         FROM page
         ORDER BY page.name COLLATE NOCASE`,
        [options.limit, options.offset ?? 0]
      );
    }

    return queryD1<Artist>(
      `SELECT artists.id,
              artists.name,
              artists.image_url,
              COUNT(songs.id) AS song_count
       FROM artists
       LEFT JOIN songs
         ON REPLACE(songs.artist, ', ', ',') = artists.name
         OR REPLACE(songs.artist, ', ', ',') LIKE artists.name || ',%'
         OR REPLACE(songs.artist, ', ', ',') LIKE '%,' || artists.name
         OR REPLACE(songs.artist, ', ', ',') LIKE '%,' || artists.name || ',%'
       GROUP BY artists.id, artists.name, artists.image_url
       HAVING COUNT(songs.id) > 0
       ORDER BY artists.name COLLATE NOCASE`
    );
  }
  const data = await sampleDataPromise;
  const byArtist = new Map<string, Artist>();
  for (const song of data.songs) {
    for (const name of splitArtistNames(song.artist)) {
      const id = slug(name);
      const current = byArtist.get(id);
      byArtist.set(id, {
        id,
        name,
        image_url: current?.image_url ?? song.cover_url,
        song_count: (current?.song_count ?? 0) + 1
      });
    }
  }
  const artists = [...byArtist.values()].sort((a, b) => a.name.localeCompare(b.name));
  return options.limit ? paginate(artists, options.limit, options.offset) : artists;
}

export async function getArtist(id: string) {
  if (hasD1Config()) {
    const rows = await queryD1<Artist>("SELECT * FROM artists WHERE id = ? LIMIT 1", [id]);
    return rows[0] ?? null;
  }
  const artists = await getArtists();
  return artists.find((artist) => artist.id === id) ?? null;
}

export async function getArtistSongs(id: string) {
  const artist = await getArtist(id);
  if (!artist) return [];
  if (hasD1Config()) {
    return queryD1<Song>(
      `SELECT *
       FROM songs
       WHERE REPLACE(artist, ', ', ',') = ?
          OR REPLACE(artist, ', ', ',') LIKE ? || ',%'
          OR REPLACE(artist, ', ', ',') LIKE '%,' || ?
          OR REPLACE(artist, ', ', ',') LIKE '%,' || ? || ',%'
       ORDER BY album COLLATE NOCASE, track_number ASC, title COLLATE NOCASE`,
      [artist.name, artist.name, artist.name, artist.name]
    );
  }
  const data = await sampleDataPromise;
  return data.songs.filter((song) => songHasArtist(song.artist, artist.name));
}

export async function getAlbums(options: PageOptions = {}): Promise<Album[]> {
  if (hasD1Config()) {
    if (options.limit) {
      return queryD1<Album>(
        `WITH page AS (
           SELECT id, title, artist, cover_url, year
           FROM albums
           ORDER BY title COLLATE NOCASE
           LIMIT ? OFFSET ?
         )
         SELECT page.id,
                page.title,
                page.artist,
                page.cover_url,
                page.year,
                (
                  SELECT COUNT(*)
                  FROM songs
                  WHERE songs.album = page.title
                ) AS song_count
         FROM page
         ORDER BY page.title COLLATE NOCASE`,
        [options.limit, options.offset ?? 0]
      );
    }

    return queryD1<Album>(
      `SELECT albums.id,
              albums.title,
              albums.artist,
              albums.cover_url,
              albums.year,
              COUNT(songs.id) AS song_count
       FROM albums
       LEFT JOIN songs ON songs.album = albums.title
       GROUP BY albums.id, albums.title, albums.artist, albums.cover_url, albums.year
       HAVING COUNT(songs.id) > 0
       ORDER BY albums.title COLLATE NOCASE`
    );
  }
  const data = await sampleDataPromise;
  const byAlbum = new Map<string, Album>();
  for (const song of data.songs) {
    const id = slug(song.album);
    const current = byAlbum.get(id);
    byAlbum.set(id, {
      id,
      title: song.album,
      artist: current?.artist ?? song.artist,
      cover_url: current?.cover_url ?? song.cover_url,
      year: current?.year ?? song.year,
      song_count: (current?.song_count ?? 0) + 1
    });
  }
  const albums = [...byAlbum.values()].sort((a, b) => a.title.localeCompare(b.title));
  return options.limit ? paginate(albums, options.limit, options.offset) : albums;
}

export async function getAlbum(id: string) {
  if (hasD1Config()) {
    const rows = await queryD1<Album>("SELECT * FROM albums WHERE id = ? LIMIT 1", [id]);
    return rows[0] ?? null;
  }
  const albums = await getAlbums();
  return albums.find((album) => album.id === id) ?? null;
}

export async function getAlbumSongs(id: string) {
  const album = await getAlbum(id);
  if (!album) return [];
  if (hasD1Config()) {
    return queryD1<Song>("SELECT * FROM songs WHERE album = ? ORDER BY track_number ASC, title COLLATE NOCASE", [album.title]);
  }
  const data = await sampleDataPromise;
  return data.songs
    .filter((song) => song.album === album.title)
    .sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0) || a.title.localeCompare(b.title));
}

export async function getFavorites(userEmail: string) {
  if (hasD1Config()) {
    return queryD1<Song>(
      "SELECT songs.* FROM favorites JOIN songs ON songs.id = favorites.song_id WHERE favorites.user_email = ? ORDER BY songs.title COLLATE NOCASE",
      [userEmail]
    );
  }
  const data = await sampleDataPromise;
  const favoriteIds = new Set(data.favorites.filter((item) => item.user_email === userEmail).map((item) => item.song_id));
  return data.songs.filter((song) => favoriteIds.has(song.id));
}

export async function addFavorite(userEmail: string, songId: string) {
  if (hasD1Config()) {
    await queryD1("INSERT OR IGNORE INTO favorites (user_email, song_id) VALUES (?, ?)", [userEmail, songId]);
    return;
  }
  const data = await sampleDataPromise;
  if (!data.favorites.some((item) => item.user_email === userEmail && item.song_id === songId)) {
    data.favorites.push({ user_email: userEmail, song_id: songId });
  }
}

export async function removeFavorite(userEmail: string, songId: string) {
  if (hasD1Config()) {
    await queryD1("DELETE FROM favorites WHERE user_email = ? AND song_id = ?", [userEmail, songId]);
    return;
  }
  const data = await sampleDataPromise;
  data.favorites = data.favorites.filter((item) => !(item.user_email === userEmail && item.song_id === songId));
}

export async function recordRecentlyPlayed(userEmail: string, songId: string) {
  if (hasD1Config()) {
    await queryD1("INSERT INTO recently_played (user_email, song_id, played_at) VALUES (?, ?, ?)", [userEmail, songId, new Date().toISOString()]);
    return;
  }
  const data = await sampleDataPromise;
  data.recently_played.push({ user_email: userEmail, song_id: songId, played_at: new Date().toISOString() });
}

export async function getRecentlyPlayed(userEmail: string) {
  if (hasD1Config()) {
    return queryD1<Song>(
      "SELECT songs.* FROM recently_played JOIN songs ON songs.id = recently_played.song_id WHERE recently_played.user_email = ? ORDER BY recently_played.played_at DESC LIMIT 30",
      [userEmail]
    );
  }
  const data = await sampleDataPromise;
  const played = data.recently_played
    .filter((item) => item.user_email === userEmail)
    .sort((a, b) => b.played_at.localeCompare(a.played_at));
  const songsById = new Map(data.songs.map((song) => [song.id, song]));
  return played.map((item) => songsById.get(item.song_id)).filter((song): song is Song => Boolean(song));
}

export async function getPlaylists(userEmail: string) {
  if (hasD1Config()) {
    return queryD1<Playlist>(
      "SELECT playlists.*, COUNT(playlist_songs.song_id) AS song_count FROM playlists LEFT JOIN playlist_songs ON playlist_songs.playlist_id = playlists.id WHERE playlists.created_by = ? GROUP BY playlists.id, playlists.name, playlists.created_by, playlists.created_at ORDER BY playlists.created_at DESC",
      [userEmail]
    );
  }
  const data = await sampleDataPromise;
  return data.playlists
    .filter((playlist) => playlist.created_by === userEmail)
    .map((playlist) => ({
      ...playlist,
      song_count: data.playlist_songs.filter((item) => item.playlist_id === playlist.id).length
    }));
}

export async function getPlaylist(id: string, userEmail: string) {
  if (hasD1Config()) {
    const rows = await queryD1<Playlist>(
      `SELECT playlists.*, COUNT(playlist_songs.song_id) AS song_count
       FROM playlists
       LEFT JOIN playlist_songs ON playlist_songs.playlist_id = playlists.id
       WHERE playlists.id = ? AND playlists.created_by = ?
       GROUP BY playlists.id, playlists.name, playlists.created_by, playlists.created_at
       LIMIT 1`,
      [id, userEmail]
    );
    return rows[0] ?? null;
  }

  const data = await sampleDataPromise;
  const playlist = data.playlists.find((item) => item.id === id && item.created_by === userEmail);
  if (!playlist) return null;
  return {
    ...playlist,
    song_count: data.playlist_songs.filter((item) => item.playlist_id === playlist.id).length
  };
}

export async function getPlaylistSongs(id: string, userEmail: string) {
  const playlist = await getPlaylist(id, userEmail);
  if (!playlist) return [];

  if (hasD1Config()) {
    return queryD1<Song>(
      `SELECT songs.*
       FROM playlist_songs
       JOIN songs ON songs.id = playlist_songs.song_id
       WHERE playlist_songs.playlist_id = ?
       ORDER BY playlist_songs.position ASC, songs.title COLLATE NOCASE`,
      [id]
    );
  }

  const data = await sampleDataPromise;
  const songsById = new Map(data.songs.map((song) => [song.id, song]));
  return data.playlist_songs
    .filter((item) => item.playlist_id === id)
    .sort((a, b) => a.position - b.position)
    .map((item) => songsById.get(item.song_id))
    .filter((song): song is Song => Boolean(song));
}

export async function getRecentlyAddedSongs() {
  return getSongs({ sort: "created_at", limit: 12 });
}
