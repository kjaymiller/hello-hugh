import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const isPublicRead = process.env.S3_PUBLIC_READ === "true";

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET;

/** Upload a photo buffer under `checkins/{id}.jpg`. Returns the object key. */
export async function uploadCheckinPhoto(id, buffer, contentType) {
  const key = `checkins/${id}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "image/jpeg",
      ...(isPublicRead ? { ACL: "public-read" } : {}),
    })
  );
  return key;
}

/** Resolve an object key to a URL the browser can load. */
export async function resolvePhotoUrl(key) {
  if (isPublicRead) {
    return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  }
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 60 * 10 } // 10 minutes, enough for a page load
  );
}
