/**
 * Walrus storage helpers.
 *
 * HOW WALRUS IS USED:
 * 1. User selects an image in the Create Campaign form.
 * 2. `uploadToWalrus()` sends the file to our own /api/upload proxy route.
 * 3. The server-side proxy forwards it to the Walrus publisher (avoids browser cert errors).
 * 4. Walrus returns a blobId — a permanent content-addressed identifier.
 * 5. The blobId is stored on-chain inside the Campaign object on Sui.
 * 6. To display the image: `${WALRUS_AGGREGATOR_URL}/v1/<blobId>`
 */

import { WALRUS_AGGREGATOR_URL } from "./constants";

export interface WalrusUploadResult {
  blobId: string;
  imageUrl: string;
}

/**
 * Upload a file via the server-side proxy (/api/upload).
 * The proxy forwards to Walrus, avoiding browser SSL cert issues with testnet.
 */
export async function uploadToWalrus(file: File): Promise<WalrusUploadResult> {
  const arrayBuffer = await file.arrayBuffer();

  const response = await fetch("/api/upload", {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error ?? `Upload failed (${response.status})`);
  }

  const data = await response.json();

  // Walrus returns either { newlyCreated: { blobObject: { blobId } } }
  // or { alreadyCertified: { blobId } } when the blob already exists.
  const blobId: string =
    data?.newlyCreated?.blobObject?.blobId ??
    data?.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error("No blobId in upload response: " + JSON.stringify(data));
  }

  return { blobId, imageUrl: getWalrusImageUrl(blobId) };
}

/**
 * Build the public URL to retrieve a Walrus blob by its ID.
 */
export function getWalrusImageUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`;
}
