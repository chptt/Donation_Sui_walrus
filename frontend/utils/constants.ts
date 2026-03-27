/**
 * Central config — all env vars consumed here so the rest of the app
 * imports from one place.
 */

export const SUI_NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as
    | "mainnet"
    | "testnet"
    | "devnet"
    | "localnet") ?? "testnet";

/** Deployed Move package ID — set after `sui client publish` */
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "";

/** Google OAuth client ID for zkLogin */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Redirect URI registered in Google OAuth console */
export const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";

/** Mysten Labs zkLogin prover endpoint */
export const PROVER_URL =
  process.env.NEXT_PUBLIC_PROVER_URL ??
  "https://prover-dev.mystenlabs.com/v1";

/**
 * Walrus publisher — used to PUT blobs (upload images).
 * Walrus stores the image off-chain; we only keep the returned blob ID on-chain.
 */
export const WALRUS_PUBLISHER_URL =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

/**
 * Walrus aggregator — used to GET blobs (display images).
 * Image URL pattern: `${WALRUS_AGGREGATOR_URL}/v1/<blobId>`
 */
export const WALRUS_AGGREGATOR_URL =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

/** Move module name inside the package */
export const MODULE_NAME = "donation_platform";

/** Number of epochs a Walrus blob should be stored for */
export const WALRUS_EPOCHS = 5;
