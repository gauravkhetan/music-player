export function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "unknown";
}

export function splitArtistNames(value: string) {
  return [...new Set(value
    .split(/\s*,\s*/g)
    .map((artist) => artist.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  )];
}

export function songHasArtist(songArtist: string, artistName: string) {
  return splitArtistNames(songArtist).some((name) => name.toLowerCase() === artistName.toLowerCase());
}
