import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PDFParse } from "pdf-parse";
import { slug, splitArtistNames } from "../lib/artist-utils";
import { loadScriptEnv } from "./env";
import { queryD1 } from "./cloud";

type PdfEntry = {
  index: number;
  title: string;
  film: string;
  artistes: string;
};

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string;
  audio_url: string;
  source_key: string | null;
};

type MatchResult = {
  song: SongRow;
  entry: PdfEntry;
  score: number;
  kind: "exact" | "fuzzy";
};

type ReviewItem = {
  reason: string;
  song?: SongRow;
  pdf_entry?: PdfEntry;
  candidate?: {
    title: string;
    film: string;
    artistes: string;
    score: number;
  };
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|part|version|commentary)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function titleCase(value: string) {
  const lowerWords = new Set(["a", "an", "and", "or", "the", "of", "in", "on", "to", "se", "ka", "ki", "ke"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowerWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanFilenameTitle(value: string) {
  const withoutExt = decodeURIComponent(value).replace(/\.[a-z0-9]{2,5}$/i, "");
  const titlePart = withoutExt.replace(/^[0-9a-f]{8}(?=[A-Z])/i, "");
  const stripped = titlePart
    .replace(/^\s*\d+\s*[-_.]\s*/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(stripped || withoutExt);
}

function isInstrumentalEntry(entry: PdfEntry) {
  return /\binstrumental\b/i.test(`${entry.title} ${entry.film} ${entry.artistes}`);
}

function objectKeyFromSong(song: SongRow, publicBaseUrl?: string, bucketName?: string) {
  if (song.source_key) return song.source_key;
  if (publicBaseUrl && song.audio_url.startsWith(publicBaseUrl)) {
    return decodeURIComponent(song.audio_url.slice(publicBaseUrl.length).replace(/^\/+/, ""));
  }
  const url = new URL(song.audio_url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (bucketName && parts[0] === bucketName) parts.shift();
  return decodeURIComponent(parts.join("/"));
}

function filenameFromKey(key: string) {
  return key.split("/").at(-1) ?? key;
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function similarity(a: string, b: string) {
  const left = compact(a);
  const right = compact(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

async function extractPdfEntries(pdfPath: string) {
  const parser = new PDFParse({ data: await readFile(pdfPath) });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));

  const entries: PdfEntry[] = [];
  let current: PdfEntry | null = null;
  let activeField: "title" | "film" | "artistes" | null = null;

  function pushCurrent() {
    if (current?.title && (current.film || current.artistes)) {
      current.title = current.title.replace(/\s+/g, " ").trim();
      current.film = current.film.replace(/\s+/g, " ").trim();
      current.artistes = current.artistes.replace(/\s+/g, " ").trim();
      entries.push(current);
    }
  }

  for (const line of lines) {
    const entryMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (entryMatch) {
      pushCurrent();
      current = {
        index: Number(entryMatch[1]),
        title: entryMatch[2].trim(),
        film: "",
        artistes: ""
      };
      activeField = "title";
      continue;
    }

    if (!current) continue;

    const filmMatch = line.match(/^Film:\s*(.+)$/i);
    if (filmMatch) {
      current.film = filmMatch[1].trim();
      activeField = "film";
      continue;
    }

    const artisteMatch = line.match(/^Artistes?:\s*(.+)$/i);
    if (artisteMatch) {
      current.artistes = artisteMatch[1].trim();
      activeField = "artistes";
      continue;
    }

    if (activeField === "artistes") {
      current.artistes = `${current.artistes} ${line}`.trim();
    } else if (activeField === "film") {
      current.film = `${current.film} ${line}`.trim();
    } else if (activeField === "title" && !/^([A-Z][A-Z .&'-]+)$/.test(line)) {
      current.title = `${current.title} ${line}`.trim();
    }
  }

  pushCurrent();

  const deduped = new Map<string, PdfEntry>();
  for (const entry of entries) {
    const key = `${compact(entry.title)}:${compact(entry.film)}:${compact(entry.artistes)}`;
    if (!deduped.has(key)) deduped.set(key, entry);
  }

  return [...deduped.values()];
}

async function ensureSchema(env: Record<string, string | undefined>) {
  const statements = [
    "ALTER TABLE songs ADD COLUMN source_key TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_source TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_confidence TEXT",
    "ALTER TABLE songs ADD COLUMN metadata_review TEXT",
    "ALTER TABLE songs ADD COLUMN enriched_at DATETIME",
    "CREATE INDEX IF NOT EXISTS idx_songs_metadata_confidence ON songs(metadata_confidence)"
  ];
  for (const statement of statements) {
    await queryD1(env, statement).catch(() => undefined);
  }
}

function buildEntryIndexes(entries: PdfEntry[]) {
  const exact = new Map<string, PdfEntry[]>();
  const buckets = new Map<string, PdfEntry[]>();
  for (const entry of entries) {
    const key = compact(entry.title);
    exact.set(key, [...(exact.get(key) ?? []), entry]);
    const bucketKey = `${key[0] ?? ""}:${Math.floor(key.length / 4)}`;
    buckets.set(bucketKey, [...(buckets.get(bucketKey) ?? []), entry]);
  }
  return { exact, buckets };
}

function candidateEntries(title: string, entries: PdfEntry[], buckets: Map<string, PdfEntry[]>) {
  const key = compact(title);
  const first = key[0] ?? "";
  const bucket = Math.floor(key.length / 4);
  const candidates = new Map<number, PdfEntry>();
  for (const offset of [-1, 0, 1]) {
    for (const entry of buckets.get(`${first}:${bucket + offset}`) ?? []) {
      candidates.set(entry.index, entry);
    }
  }
  return candidates.size ? [...candidates.values()] : entries;
}

function chooseBestEntry(song: SongRow, entries: PdfEntry[], indexes: ReturnType<typeof buildEntryIndexes>, env: Record<string, string | undefined>): MatchResult | null {
  const key = objectKeyFromSong(song, env.R2_PUBLIC_BASE_URL, env.R2_BUCKET_NAME);
  const cleanedTitle = cleanFilenameTitle(filenameFromKey(key));
  const candidates = [song.title, cleanedTitle].filter(Boolean);

  for (const candidate of candidates) {
    const exactMatches = indexes.exact.get(compact(candidate));
    if (exactMatches?.length === 1) {
      return { song, entry: exactMatches[0], score: 1, kind: "exact" };
    }
    if (exactMatches && exactMatches.length > 1) {
      const vocalMatches = exactMatches.filter((entry) => !isInstrumentalEntry(entry));
      if (vocalMatches.length === 1) {
        return { song, entry: vocalMatches[0], score: 1, kind: "exact" };
      }
    }
  }

  let best: { entry: PdfEntry; score: number } | null = null;
  let secondBest = 0;
  const fuzzyPool = candidateEntries(cleanedTitle || song.title, entries, indexes.buckets);
  for (const entry of fuzzyPool) {
    const score = Math.max(...candidates.map((candidate) => similarity(candidate, entry.title)));
    if (!best || score > best.score) {
      secondBest = best?.score ?? 0;
      best = { entry, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (best && best.score >= 0.88 && best.score - secondBest >= 0.03) {
    return { song, entry: best.entry, score: best.score, kind: "fuzzy" };
  }

  return null;
}

async function updateSongs(env: Record<string, string | undefined>, matches: MatchResult[]) {
  const groups = chunk(matches, 5);
  for (const [index, group] of groups.entries()) {
    const updateFields = [
      { column: "title", value: (match: MatchResult) => match.entry.title },
      { column: "artist", value: (match: MatchResult) => match.entry.artistes || "Unknown Artist" },
      { column: "album", value: (match: MatchResult) => match.entry.film || "Unknown Album" },
      { column: "metadata_source", value: () => "saregama_pdf" },
      { column: "metadata_confidence", value: (match: MatchResult) => (match.kind === "exact" ? "high" : "medium") },
      {
        column: "metadata_review",
        value: (match: MatchResult) => (match.kind === "exact" ? null : `Fuzzy title match score ${match.score.toFixed(3)}`)
      },
      { column: "enriched_at", value: () => new Date().toISOString() }
    ];

    const params: unknown[] = [];
    const assignments = updateFields.map((field) => {
      const cases = group.map((match) => {
        params.push(match.song.id, field.value(match));
        return "WHEN ? THEN ?";
      }).join(" ");
      return `${field.column} = CASE id ${cases} ELSE ${field.column} END`;
    });
    params.push(...group.map((match) => match.song.id));

    await queryD1(
      env,
      `UPDATE songs
       SET ${assignments.join(", ")}
       WHERE id IN (${group.map(() => "?").join(", ")})`,
      params
    );
    console.log(`Updated ${Math.min((index + 1) * 5, matches.length)} / ${matches.length} songs`);
  }
}

async function rebuildArtistAlbumTables(env: Record<string, string | undefined>) {
  await queryD1(env, "DELETE FROM artists");
  await queryD1(env, "DELETE FROM albums");

  const songs = await queryD1<{ artist: string; cover_url: string | null }>(
    env,
    "SELECT artist, cover_url FROM songs WHERE artist IS NOT NULL AND artist != ''"
  );
  const artists = new Map<string, { id: string; name: string; image_url: string | null }>();
  for (const song of songs) {
    for (const name of splitArtistNames(song.artist)) {
      const id = slug(name);
      const current = artists.get(id);
      artists.set(id, { id, name, image_url: current?.image_url ?? song.cover_url });
    }
  }
  for (const group of chunk([...artists.values()], 25)) {
    const placeholders = group.map(() => "(?, ?, ?)").join(", ");
    await queryD1(env, `INSERT OR REPLACE INTO artists (id, name, image_url) VALUES ${placeholders}`, group.flatMap((artist) => [artist.id, artist.name, artist.image_url]));
  }

  const albums = await queryD1<{ title: string; artist: string; cover_url: string | null; year: number | null }>(
    env,
    "SELECT album AS title, artist, MAX(cover_url) AS cover_url, MAX(year) AS year FROM songs WHERE album IS NOT NULL AND album != '' GROUP BY artist, album"
  );
  for (const group of chunk(albums, 20)) {
    const placeholders = group.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await queryD1(env, `INSERT OR REPLACE INTO albums (id, title, artist, cover_url, year) VALUES ${placeholders}`, group.flatMap((album) => [slug(`${album.artist}-${album.title}`), album.title, album.artist, album.cover_url, album.year]));
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function main() {
  const env = await loadScriptEnv();
  const pdfPath = process.argv.find((arg) => arg.endsWith(".pdf")) ?? "Saregama_Carvaan_2.0_Songlist_1.0.pdf";
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  const reviewPath = "data/pdf-metadata-review.json";

  await ensureSchema(env);
  const entries = await extractPdfEntries(pdfPath);
  const indexes = buildEntryIndexes(entries);
  const songs = await queryD1<SongRow>(
    env,
    `SELECT id, title, artist, album, audio_url, source_key
     FROM songs
     ORDER BY title COLLATE NOCASE
     ${limit ? "LIMIT ?" : ""}`,
    limit ? [limit] : []
  );

  const matches: MatchResult[] = [];
  const reviews: ReviewItem[] = [];
  const usedEntryKeys = new Set<string>();

  for (const song of songs) {
    const match = chooseBestEntry(song, entries, indexes, env);
    if (!match) {
      reviews.push({ reason: "No confident PDF title match", song });
      continue;
    }

    const entryKey = `${match.entry.index}:${compact(match.entry.title)}:${compact(match.entry.film)}`;
    if (usedEntryKeys.has(entryKey) && match.kind === "fuzzy") {
      reviews.push({
        reason: "Fuzzy PDF entry already used by another song",
        song,
        candidate: {
          title: match.entry.title,
          film: match.entry.film,
          artistes: match.entry.artistes,
          score: match.score
        }
      });
      continue;
    }

    usedEntryKeys.add(entryKey);
    matches.push(match);
  }

  if (!dryRun) {
    await updateSongs(env, matches);
    await rebuildArtistAlbumTables(env);
  }

  await mkdir(dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    pdf_entries: entries.length,
    songs_checked: songs.length,
    matches: matches.length,
    exact_matches: matches.filter((match) => match.kind === "exact").length,
    fuzzy_matches: matches.filter((match) => match.kind === "fuzzy").length,
    review_items: reviews.length,
    items: reviews.slice(0, 1000)
  }, null, 2));

  console.log(`PDF entries: ${entries.length}`);
  console.log(`Songs checked: ${songs.length}`);
  console.log(`Matches: ${matches.length} (${matches.filter((match) => match.kind === "exact").length} exact, ${matches.filter((match) => match.kind === "fuzzy").length} fuzzy)`);
  console.log(`Review items: ${reviews.length}`);
  console.log(`Review file: ${reviewPath}`);
  if (dryRun) console.log("Dry run only; D1 was not updated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
