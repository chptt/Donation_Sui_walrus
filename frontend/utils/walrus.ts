/**
 * Walrus storage helpers.
 *
 * HOW WALRUS IS USED:
 * 1. The user selects an image in the Create Campaign form.
 * 2. `uploadToWalrus()` sends the raw bytes to the Walrus publisher via HTTP PUT.
 * 3. Walrus returns a JSON response containing a `blobId` (a content-addressed hash).
 * 4. That blobId is passed to the Move `create_campaign` entry function and stored on-chain.
 * 5. To display the image later, we reconstruct the URL:
 *    `${WALRUS_AGGREGATOR_URL}/v1/<blobId>`
 *
 * No image data ever touches the Sui blockchain — only the blobId string.
 */

import { WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL, WALRUS_EPOCHS } from "./constants";

export interface WalrusUploadResult {
  blobId: string;
  /** Convenience URL for displaying the image */
  imageUrl: string;
}

/**
 * Upload a file to Walrus and return the blob ID + display URL.
 * Throws if the upload fails or the response is malformed.
 */
export async function uploadToWalrus(file: File): Promise<WalrusUploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // PUT the raw bytes to the Walrus publisher endpoint.
  // The `epochs` query param controls how long the blob is retained.
  const response = await fetch(
    `${WALRUS_PUBLISHER_URL}/v1/store?epochs=${WALRUS_EPOCHS}`,
    {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: bytes,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walrus upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Walrus returns either { newlyCreated: { blobObject: { blobId } } }
  // or { alreadyCertified: { blobId } } when the blob already exists.
  const blobId: string =
    data?.newlyCreated?.blobObject?.blobId ??
    data?.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error("Walrus response did not contain a blobId: " + JSON.stringify(data));
  }

  return {
    blobId,
    imageUrl: getWalrusImageUrl(blobId),
  };
}

/**
 * Build the public URL to retrieve a Walrus blob by its ID.
 * This URL can be used directly in <img src="..."> or Next.js <Image>.
 */
export function getWalrusImageUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR_URL}/v1/${blobId}`;
}
