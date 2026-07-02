/**
 * zkLogin helpers.
 *
 * HOW zkLogin WORKS:
 * 1. Generate ephemeral Ed25519 keypair, store in localStorage.
 * 2. Fetch current Sui epoch, compute maxEpoch = epoch + 10.
 * 3. Build nonce = hash(ephemeralPubkey, maxEpoch, randomness).
 * 4. Redirect to Google OAuth with nonce embedded.
 * 5. Google returns JWT containing the nonce.
 * 6. Send JWT + ephemeral pubkey to Mysten prover → get ZK proof.
 * 7. Use ZK proof + ephemeral signature to sign Sui transactions.
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
import { GOOGLE_CLIENT_ID, REDIRECT_URI } from "./constants";

const KEY_EPHEMERAL_SECRET = "zklogin_ephemeral_secret";
const KEY_MAX_EPOCH        = "zklogin_max_epoch";
const KEY_RANDOMNESS       = "zklogin_randomness";
const KEY_USER_SALT        = "zklogin_salt";
const KEY_ZK_PROOF         = "zklogin_proof";
const KEY_JWT              = "zklogin_jwt";
const KEY_ADDRESS          = "zklogin_address";
const KEY_ADDRESS_SEED     = "zklogin_address_seed";

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

export async function handleZkLoginCallback(): Promise<ZkLoginSession | null> {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const jwt = params.get("id_token");
  if (!jwt) return null;

  const secretKey  = localStorage.getItem(KEY_EPHEMERAL_SECRET);
  const maxEpoch   = Number(localStorage.getItem(KEY_MAX_EPOCH));
  const randomness = localStorage.getItem(KEY_RANDOMNESS) ?? "";
  const userSalt   = localStorage.getItem(KEY_USER_SALT) ?? getOrCreateUserSalt();

  if (!secretKey || !maxEpoch || !randomness) {
    throw new Error("Session data missing. Please log in again.");
  }

  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);

  // Decode JWT to get sub and aud for addressSeed
  const decoded = decodeJwt(jwt);
  const sub = decoded.sub as string;
  const aud = Array.isArray(decoded.aud)
    ? (decoded.aud[0] as string)
    : (decoded.aud as string);

  // addressSeed = genAddressSeed(salt, "sub", sub, aud)
  // This MUST be computed identically here and in executeWithZkLogin
  const addressSeed = genAddressSeed(BigInt(userSalt), "sub", sub, aud).toString();

  // Derive Sui address — uses same genAddressSeed internally
  const address = jwtToAddress(jwt, userSalt);

  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey()
  );

  // Call prover via server-side proxy
  const proofResponse = await fetch("/api/zkproof", {
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

  // Enoki returns addressSeed in the proof response — use it directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enokiAddressSeed = (proof as any).addressSeed as string | undefined;
  const finalAddressSeed = enokiAddressSeed ?? addressSeed;

  // Derive the address from the addressSeed that will actually be used in the signature
  // This ensures session.address matches what the zkLogin signature proves
  const { computeZkLoginAddressFromSeed } = await import("@mysten/sui/zklogin");
  const decoded2 = decodeJwt(jwt);
  const iss = decoded2.iss as string;
  const finalAddress = finalAddressSeed
    ? computeZkLoginAddressFromSeed(BigInt(finalAddressSeed), iss)
    : address;

  localStorage.setItem(KEY_JWT, jwt);
  localStorage.setItem(KEY_ZK_PROOF, JSON.stringify(proof));
  localStorage.setItem(KEY_ADDRESS, finalAddress);
  localStorage.setItem(KEY_ADDRESS_SEED, finalAddressSeed);

  return { address: finalAddress, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt, addressSeed: finalAddressSeed };
}

export function getZkLoginSession(): ZkLoginSession | null {
  try {
    const address     = localStorage.getItem(KEY_ADDRESS);
    const jwt         = localStorage.getItem(KEY_JWT);
    const proofRaw    = localStorage.getItem(KEY_ZK_PROOF);
    const secretKey   = localStorage.getItem(KEY_EPHEMERAL_SECRET);
    const maxEpoch    = Number(localStorage.getItem(KEY_MAX_EPOCH));
    const randomness  = localStorage.getItem(KEY_RANDOMNESS) ?? "";
    const userSalt    = localStorage.getItem(KEY_USER_SALT) ?? "";
    let addressSeed   = localStorage.getItem(KEY_ADDRESS_SEED) ?? "";

    if (!address || !jwt || !proofRaw || !secretKey) return null;

    // Recompute addressSeed if missing (backwards compat for old sessions)
    if (!addressSeed && jwt && userSalt) {
      try {
        const decoded = decodeJwt(jwt);
        const sub = decoded.sub as string;
        const aud = Array.isArray(decoded.aud)
          ? (decoded.aud[0] as string)
          : (decoded.aud as string);
        addressSeed = genAddressSeed(BigInt(userSalt), "sub", sub, aud).toString();
        localStorage.setItem(KEY_ADDRESS_SEED, addressSeed);
      } catch {
        return null;
      }
    }

    if (!addressSeed) return null;

    const proof = JSON.parse(proofRaw) as ZkProof;
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKey);

    return { address, jwt, proof, ephemeralKeypair, maxEpoch, randomness, userSalt, addressSeed };
  } catch {
    return null;
  }
}

export function clearZkLoginSession(): void {
  // NOTE: KEY_USER_SALT is intentionally NOT cleared — it must persist so
  // the same Google account always maps to the same Sui address on this browser.
  [
    KEY_EPHEMERAL_SECRET,
    KEY_MAX_EPOCH,
    KEY_RANDOMNESS,
    KEY_ZK_PROOF,
    KEY_JWT,
    KEY_ADDRESS,
    KEY_ADDRESS_SEED,
  ].forEach((k) => localStorage.removeItem(k));
}

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
