CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  genre TEXT,
  duration INTEGER,
  cover_url TEXT,
  audio_url TEXT NOT NULL,
  track_number INTEGER,
  year INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT,
  year INTEGER
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id TEXT,
  song_id TEXT,
  position INTEGER,
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_email TEXT,
  song_id TEXT,
  PRIMARY KEY (user_email, song_id)
);

CREATE TABLE IF NOT EXISTS recently_played (
  user_email TEXT,
  song_id TEXT,
  played_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_songs_search ON songs(title, artist, album);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album, artist);
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_audio_url ON songs(audio_url);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_email, played_at);
