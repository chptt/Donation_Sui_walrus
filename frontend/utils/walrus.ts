// walrus upload utility v2
import { WALRUS_AGGREGATOR_URL } from "./constants";

export interface WalrusUploadResult {
  blobId: string;
  imageUrl: string;
}

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
