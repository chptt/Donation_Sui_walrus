/**
 * Sui transaction helpers.
 *
 * HOW THE IMAGE REFERENCE IS STORED ON-CHAIN:
 * The Walrus blobId (e.g. "abc123xyz...") is passed as `walrus_blob_id` to the
 * Move `create_campaign` entry function and stored as a String field inside the
 * Campaign shared object on Sui. No image bytes ever touch the blockchain.
 *
 * To display the image later:
 *   `${WALRUS_AGGREGATOR_URL}/v1/<walrusBlobId>`
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { SUI_NETWORK, PACKAGE_ID, MODULE_NAME } from "./constants";
import type { ZkLoginSession } from "./zklogin";

// Singleton SuiClient — shared across the app
export const suiClient = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignOnChain {
  id: string;
  creator: string;
  title: string;
  description: string;
  targetAmount: bigint;
  amountRaised: bigint;
  walrusBlobId: string;
  isActive: boolean;
}

// ─── Create Campaign ──────────────────────────────────────────────────────────

/**
 * Build and execute a `create_campaign` transaction.
 * `walrusBlobId` is the string returned by Walrus after uploading the image.
 * It is stored permanently inside the Campaign shared object on Sui.
 */
export async function createCampaignTx(
  session: ZkLoginSession,
  params: {
    title: string;
    description: string;
    targetAmountMist: bigint;
    walrusBlobId: string;
  }
): Promise<string> {
  const tx = new Transaction();

  // Pass walrusBlobId as a Move vector<u8> (bytes) — the contract converts it to String
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_campaign`,
    arguments: [
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.title))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.description))),
      tx.pure.u64(params.targetAmountMist),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(params.walrusBlobId))),
    ],
  });

  tx.setSender(session.address);
  return executeWithZkLogin(tx, session);
}

// ─── Donate ───────────────────────────────────────────────────────────────────

/**
 * Build and execute a `donate` transaction.
 * Splits `amountMist` from the gas coin and passes it to the campaign.
 */
export async function donateTx(
  session: ZkLoginSession,
  campaignId: string,
  amountMist: bigint
): Promise<string> {
  const tx = new Transaction();

  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::donate`,
    arguments: [tx.object(campaignId), coin],
  });

  tx.setSender(session.address);
  return executeWithZkLogin(tx, session);
}

// ─── zkLogin transaction signing ─────────────────────────────────────────────

/**
 * Sign a transaction with the ephemeral keypair and wrap it in a zkLogin signature.
 *
 * The zkLogin signature bundles:
 *   - ephemeral signature  (from the short-lived Ed25519 keypair)
 *   - ZK proof             (from the Mysten prover — proves JWT ownership without revealing it)
 *   - maxEpoch             (validity window)
 *
 * Sui validators verify this without ever learning the user's Google identity.
 */
async function executeWithZkLogin(
  tx: Transaction,
  session: ZkLoginSession
): Promise<string> {
  const { bytes, signature: ephemeralSig } = await tx.sign({
    client: suiClient,
    signer: session.ephemeralKeypair,
  });

  // Use the addressSeed stored during login (computed from JWT sub + salt by the prover flow)
  const addressSeed = session.addressSeed;

  // Build the full zkLogin signature from proof + ephemeral sig
  const zkSig = getZkLoginSignature({
    inputs: {
      proofPoints: session.proof.proofPoints,
      issBase64Details: session.proof.issBase64Details,
      headerBase64: session.proof.headerBase64,
      addressSeed,
    },
    maxEpoch: session.maxEpoch,
    userSignature: ephemeralSig,
  });

  const result = await suiClient.executeTransactionBlock({
    transactionBlock: bytes,
    signature: zkSig,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    const errMsg = JSON.stringify(result.effects?.status);
    // Groth16 / signature errors mean the zkLogin proof is stale — force re-login
    if (errMsg.includes("Groth16") || errMsg.includes("signature") || errMsg.includes("proof")) {
      // Clear stale session so user gets prompted to re-login
      const { clearZkLoginSession } = await import("./zklogin");
      clearZkLoginSession();
      throw new Error("Your session has expired. Please sign out and sign in again.");
    }
    throw new Error("Transaction failed: " + errMsg);
  }

  return result.digest;
}

// ─── Read campaigns ───────────────────────────────────────────────────────────

/**
 * Fetch a single campaign object from Sui by its object ID.
 */
export async function fetchCampaign(
  campaignId: string
): Promise<CampaignOnChain | null> {
  const obj = await suiClient.getObject({
    id: campaignId,
    options: { showContent: true },
  });
  return parseCampaignObject(obj);
}

/**
 * Fetch all campaigns by querying CampaignCreated events emitted by the package.
 * Each event contains the campaign object ID; we then fetch each object.
 */
export async function fetchAllCampaigns(): Promise<CampaignOnChain[]> {
  if (!PACKAGE_ID) return [];

  const result = await suiClient.queryEvents({
    query: {
      MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::CampaignCreated`,
    },
    limit: 50,
  });

  const ids = result.data.map(
    (e) => (e.parsedJson as { campaign_id: string }).campaign_id
  );

  const campaigns = await Promise.all(ids.map(fetchCampaign));
  return campaigns.filter(Boolean) as CampaignOnChain[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCampaignObject(obj: any): CampaignOnChain | null {
  const content = obj?.data?.content;
  if (!content || content.dataType !== "moveObject") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = content.fields as Record<string, any>;
  return {
    id: obj.data.objectId,
    creator: fields.creator,
    title: fields.title,
    description: fields.description,
    targetAmount: BigInt(fields.target_amount),
    amountRaised: BigInt(fields.amount_raised),
    walrusBlobId: fields.walrus_blob_id, // ← Walrus blob ID read from on-chain object
    isActive: fields.is_active === true || fields.is_active === "true",
  };
}

/** Convert SUI to MIST (1 SUI = 1_000_000_000 MIST) */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * 1_000_000_000));
}

/** Convert MIST to SUI */
export function mistToSui(mist: bigint): number {
  return Number(mist) / 1_000_000_000;
}
