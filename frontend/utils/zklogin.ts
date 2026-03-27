/**
 * zkLogin helpers.
 *
 * HOW zkLogin WORKS (step by step):
 * 1. Generate an ephemeral Ed25519 keypair (short-lived, stored in sessionStorage).
 * 2. Fetch the current epoch from Sui to define a validity window (maxEpoch).
 * 3. Build a nonce that commits to: ephemeral public key + maxEpoch + randomness.
 * 4. Redirect the user to Google OAuth with that nonce in the request.
 * 5. Google returns a signed JWT containing the nonce in its claims.
 * 6. Send the JWT + ephemeral public key to the Mysten ZK prover service.
 * 7. The prover returns a zero-knowledge proof (proves JWT ownership without revealing it).
 * 8. Combine the ZK proof + ephemeral signature to form a valid Sui transaction signature.
 *
 * The user's Sui address is derived deterministically from their Google `sub` + a salt.
 * No long-term private key is ever stored — identity = wallet address.
 */

import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient } from "@mysten/sui/client";
import { GOOGLE_CLIENT_ID, REDIRECT_URI, PROVER_URL } from "./constants";

// ─── SessionStorage keys ──────────────────────────────────────────────────────
const KEY_EPHEMERAL_SECRET = "zklogin_ephemeral_secret";
const KEY_MAX_EPOCH = "zklogin_max_epoch";
const KEY_RANDOMNESS = "zklogin_randomness";
const KEY_USER_SALT = "zklogin_user_salt";
const KEY_ZK_PROOF = "zklogin_proof";
const KEY_JWT = "zklogin_jwt";
const KEY_ADDRESS = "zklogin_address";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZkLoginSession {
  address: string;
  jwt: string;
  proof: ZkProof;
  ephemeralKeypair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  userSalt: string;
}

export interface ZkProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

// ─── Step 1: Initiate OAuth login ─────────────────────────────────────────────

/**
 * Generates an ephemeral keypair, builds a nonce, and redirects to Google OAuth.
 * Call this when the user clicks "Login with Google".
 */
export async function initiateZkLogin(suiClient: SuiClient): Promise<void> {
  const ephemeralKeypair = new Ed25519Keypair();

  // Fetch current epoch to set the validity window
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10; // valid for ~10 epochs

  const randomness = generateRandomness();

  // Nonce commits to: ephemeral pubkey + maxEpoch + randomness
  const nonce = generateNonce(
    ephemeralKeypair.getPublicKey(),
    maxEpoch,
    randomness
  );

  // Store the secret key bytes (Uint8Array → base64 string for safe storage)
  const secretKey = ephemeralKeypair.getSecretKey(); // returns base64url string in newer SDK
  sessionStorage.setItem(KEY_EPHEMERAL_SECRET, secretKey);
  sessionStorage.setItem(KEY_MAX_EPOCH, String(maxEpoch));
  sessionStorage.setItem(KEY_RANDOMNESS, randomness);

  const userSalt = getOrCreateUserSalt();
  sessionStorage.setItem(KEY_USER_SALT, userSalt);

  // Redirect to Google OAuth — execution stops here
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Step 2: Handle OAuth callback ───────────────────────────────────────────

/**
 * Called on the /auth/callback page after Google redirects back.
 * Extracts the JWT from the URL hash, calls the Mysten prover, stores the session.
 */
export async function handleZkLoginCallback(): Promise<ZkLoginSession | null> {
  // Google returns the JWT in the URL fragment: #id_token=<jwt>&...
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const jwt = params.get("id_token");

  if (!jwt) return null;

  const secretKey = sessionStorage.getItem(KEY_EPHEMERAL_SECRET);
  const maxEpoch = Number(sessionStorage.getItem(KEY_MAX_EPOCH));
  const randomness = sessionStorage.getItem(KEY_RANDOMNESS) ?? "";
  const userSalt = sessionStorage.getItem(KEY_USER_SALT) ?? getOrCreateUserSalt();

  if (!secretKey || !maxEpoch || !randomness) {
    throw new Error("zkLogin session data missing. Please log in again.");
  }

  // Restore the ephemeral keypair from the stored secret key
  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);

  // Derive the Sui address from the JWT sub claim + salt
  const address = jwtToAddress(jwt, userSalt);

  // Build the extended ephemeral public key for the prover request
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey()
  );

  // Request a ZK proof from the Mysten prover service
  const proofResponse = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch,
      jwtRandomness: randomness,
      salt: userSalt,
      keyClaimName: "sub",
    }),
  });

  if (!proofResponse.ok) {
    const err = await proofResponse.text();
    throw new Error(`ZK Prover error (${proofResponse.status}): ${err}`);
  }

  const proof: ZkProof = await proofResponse.json();

  // Persist the full session
  sessionStorage.setItem(KEY_JWT, jwt);
  sessionStorage.setItem(KEY_ZK_PROOF, JSON.stringify(proof));
  sessionStorage.setItem(KEY_ADDRESS, address);

  return { address, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt };
}

// ─── Session retrieval ────────────────────────────────────────────────────────

/**
 * Restore a zkLogin session from sessionStorage.
 * Returns null if the user is not logged in or session has expired.
 */
export function getZkLoginSession(): ZkLoginSession | null {
  try {
    const address = sessionStorage.getItem(KEY_ADDRESS);
    const jwt = sessionStorage.getItem(KEY_JWT);
    const proofRaw = sessionStorage.getItem(KEY_ZK_PROOF);
    const secretKey = sessionStorage.getItem(KEY_EPHEMERAL_SECRET);
    const maxEpoch = Number(sessionStorage.getItem(KEY_MAX_EPOCH));
    const randomness = sessionStorage.getItem(KEY_RANDOMNESS) ?? "";
    const userSalt = sessionStorage.getItem(KEY_USER_SALT) ?? "";

    if (!address || !jwt || !proofRaw || !secretKey) return null;

    const proof: ZkProof = JSON.parse(proofRaw);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);

    return { address, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt };
  } catch {
    return null;
  }
}

/** Clear all zkLogin session data (logout). */
export function clearZkLoginSession(): void {
  [
    KEY_EPHEMERAL_SECRET,
    KEY_MAX_EPOCH,
    KEY_RANDOMNESS,
    KEY_USER_SALT,
    KEY_ZK_PROOF,
    KEY_JWT,
    KEY_ADDRESS,
  ].forEach((k) => sessionStorage.removeItem(k));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get or create a stable per-browser salt stored in localStorage.
 * The salt is a large random BigInt string — required format for jwtToAddress().
 *
 * NOTE: In production, use a dedicated salt service keyed to the user's `sub`
 * so the same Google account always maps to the same Sui address across devices.
 */
function getOrCreateUserSalt(): string {
  const existing = localStorage.getItem("zklogin_salt");
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = BigInt(
    "0x" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
  ).toString();

  localStorage.setItem("zklogin_salt", salt);
  return salt;
}
