/**
 * zkLogin helpers.
 *
 * HOW zkLogin WORKS (step by step):
 * 1. Generate an ephemeral Ed25519 keypair (short-lived, stored in localStorage).
 * 2. Fetch the current epoch from Sui to define a validity window (maxEpoch).
 * 3. Build a nonce that commits to: ephemeral public key + maxEpoch + randomness.
 * 4. Redirect the user to Google OAuth with that nonce in the request.
 * 5. Google returns a signed JWT containing the nonce in its claims.
 * 6. Send the JWT + ephemeral public key to the Mysten ZK prover service.
 * 7. The prover returns a zero-knowledge proof (proves JWT ownership without revealing it).
 * 8. Combine the ZK proof + ephemeral signature to form a valid Sui transaction signature.
 *
 * NOTE: We use localStorage (not sessionStorage) for pre-auth data because
 * sessionStorage is cleared during cross-origin OAuth redirects in some browsers.
 * Post-auth session data (proof, JWT, address) also uses localStorage for persistence.
 */

import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import { decodeJwt } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient } from "@mysten/sui/client";
import { GOOGLE_CLIENT_ID, REDIRECT_URI, PROVER_URL } from "./constants";

// ─── Storage keys (all in localStorage to survive cross-origin redirects) ─────
const KEY_EPHEMERAL_SECRET = "zklogin_ephemeral_secret";
const KEY_MAX_EPOCH        = "zklogin_max_epoch";
const KEY_RANDOMNESS       = "zklogin_randomness";
const KEY_USER_SALT        = "zklogin_salt";
const KEY_ZK_PROOF         = "zklogin_proof";
const KEY_JWT              = "zklogin_jwt";
const KEY_ADDRESS          = "zklogin_address";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZkLoginSession {
  address: string;
  jwt: string;
  proof: ZkProof;
  ephemeralKeypair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  userSalt: string;
  addressSeed: string;
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
 * All pre-auth data is stored in localStorage so it survives the cross-origin redirect.
 */
export async function initiateZkLogin(suiClient: SuiClient): Promise<void> {
  const ephemeralKeypair = new Ed25519Keypair();

  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10;

  const randomness = generateRandomness();

  const nonce = generateNonce(
    ephemeralKeypair.getPublicKey(),
    maxEpoch,
    randomness
  );

  const userSalt = getOrCreateUserSalt();

  // Store in localStorage — survives cross-origin OAuth redirect
  localStorage.setItem(KEY_EPHEMERAL_SECRET, ephemeralKeypair.getSecretKey());
  localStorage.setItem(KEY_MAX_EPOCH, String(maxEpoch));
  localStorage.setItem(KEY_RANDOMNESS, randomness);
  localStorage.setItem(KEY_USER_SALT, userSalt);

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
 * Reads pre-auth data from localStorage, calls the prover, stores the session.
 */
export async function handleZkLoginCallback(): Promise<ZkLoginSession | null> {
  // Google returns the JWT in the URL fragment: #id_token=<jwt>&...
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const jwt = params.get("id_token");

  if (!jwt) return null;

  const secretKey  = localStorage.getItem(KEY_EPHEMERAL_SECRET);
  const maxEpoch   = Number(localStorage.getItem(KEY_MAX_EPOCH));
  const randomness = localStorage.getItem(KEY_RANDOMNESS) ?? "";
  const userSalt   = localStorage.getItem(KEY_USER_SALT) ?? getOrCreateUserSalt();

  if (!secretKey || !maxEpoch || !randomness) {
    throw new Error("zkLogin session data missing. Please log in again.");
  }

  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  const address = jwtToAddress(jwt, userSalt);

  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey()
  );

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

  // Compute addressSeed from JWT claims + salt (must match what the prover used)
  const decodedJwt = decodeJwt(jwt);
  const addressSeed: string = (proof as ZkProof & { addressSeed?: string }).addressSeed
    ?? genAddressSeed(BigInt(userSalt), "sub", decodedJwt.sub as string,
        Array.isArray(decodedJwt.aud) ? decodedJwt.aud[0] as string : decodedJwt.aud as string
       ).toString();

  // Persist full session in localStorage
  localStorage.setItem(KEY_JWT, jwt);
  localStorage.setItem(KEY_ZK_PROOF, JSON.stringify(proof));
  localStorage.setItem(KEY_ADDRESS, address);
  localStorage.setItem("zklogin_address_seed", addressSeed);

  return { address, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt, addressSeed };
}

// ─── Session retrieval ────────────────────────────────────────────────────────

export function getZkLoginSession(): ZkLoginSession | null {
  try {
    const address   = localStorage.getItem(KEY_ADDRESS);
    const jwt       = localStorage.getItem(KEY_JWT);
    const proofRaw  = localStorage.getItem(KEY_ZK_PROOF);
    const secretKey = localStorage.getItem(KEY_EPHEMERAL_SECRET);
    const maxEpoch  = Number(localStorage.getItem(KEY_MAX_EPOCH));
    const randomness = localStorage.getItem(KEY_RANDOMNESS) ?? "";
    const userSalt  = localStorage.getItem(KEY_USER_SALT) ?? "";

    if (!address || !jwt || !proofRaw || !secretKey) return null;

    const proof = JSON.parse(proofRaw) as ZkProof;
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);
    const addressSeed = localStorage.getItem("zklogin_address_seed") ?? userSalt;

    return { address, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt, addressSeed };
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
    "zklogin_address_seed",
  ].forEach((k) => localStorage.removeItem(k));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateUserSalt(): string {
  const existing = localStorage.getItem(KEY_USER_SALT);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = BigInt(
    "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
  ).toString();

  localStorage.setItem(KEY_USER_SALT, salt);
  return salt;
}
