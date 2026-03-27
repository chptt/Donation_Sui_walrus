/**
 * Walrus storage helpers.
 * Uses staketab community endpoint which has a valid SSL cert.
 * Falls back to proxy if direct upload fails.
 */

import { WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL, WALRUS_EPOCHS } from "./constants";

export interface WalrusUploadResult {
  blobId: string;
  imageUrl: string;
}

export async function uploadToWalrus(file: File): Promise<WalrusUploadResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Try direct upload first (works if endpoint has valid cert)
  let response: Response;
  try {
    response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/store?epochs=${WALRUS_EPOCHS}`, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: arrayBuffer,
    });
  } catch {
    // Direct failed (cert issue) — fall back to server proxy
    response = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: arrayBuffer,
    });
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error ?? `Upload failed (${response.status})`);
  }

  const data = await response.json();
  const blobId: string =
    data?.newlyCreated?.blobObject?.blobId ??
    data?.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error("No blobId in response: " + JSON.stringify(data));
  }

  return { blobId, imageUrl: getWalrusImageUrl(blobId) };
}

export function getWalrusImageUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`;
}
