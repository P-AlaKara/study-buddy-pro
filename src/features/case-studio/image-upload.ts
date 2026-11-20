import { createCaseImageUpload } from "./studio.functions";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadedImage {
  url: string;
  fileName: string;
}

/**
 * Upload one image for a case. The server checks the account and issues a
 * one-time upload URL; the browser then sends the file straight to the
 * `case-images` bucket, so big scans never pass through the app server
 * (which caps request bodies at 4.5 MB on Vercel).
 */
export async function uploadCaseImage(caseId: string, file: File): Promise<UploadedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images can be at most 10 MB.");
  }
  const target = await createCaseImageUpload({
    data: { caseId, fileName: file.name, contentType: file.type, size: file.size },
  });
  // Same request shape as supabase-js `uploadToSignedUrl`.
  const body = new FormData();
  body.append("cacheControl", "31536000");
  body.append("", file);
  const response = await fetch(target.uploadUrl, {
    method: "PUT",
    body,
    headers: { "x-upsert": "false" },
  });
  if (!response.ok) {
    throw new Error(`The upload failed (${response.status}). Check your connection and try again.`);
  }
  return { url: target.publicUrl, fileName: target.fileName };
}
