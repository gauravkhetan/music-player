import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Song } from "@/types/music";

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 signing is not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

export function getObjectKeyFromSong(song: Song) {
  if (song.source_key) return song.source_key;

  const bucketName = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (publicBaseUrl && song.audio_url.startsWith(publicBaseUrl)) {
    return decodeURIComponent(song.audio_url.slice(publicBaseUrl.length).replace(/^\/+/, ""));
  }

  const url = new URL(song.audio_url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (bucketName && parts[0] === bucketName) parts.shift();
  return decodeURIComponent(parts.join("/"));
}

export async function createSignedAudioUrl(song: Song) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured.");

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: getObjectKeyFromSong(song)
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 60 });
}
