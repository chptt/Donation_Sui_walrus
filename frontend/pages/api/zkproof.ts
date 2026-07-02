/**
 * ZK Proof proxy.
 *
 * Routes to the correct prover based on available config:
 * - If ENOKI_API_KEY is set → use Enoki (production, works with any OAuth client)
 * - Otherwise → use prover-dev (dev only, Groth16 may fail on testnet validators)
 *
 * To fix Groth16 errors:
 * 1. Go to https://enoki.mystenlabs.com → create app → get API key
 * 2. Add ENOKI_API_KEY to Vercel env vars
 * 3. Redeploy
 */
import type { NextApiRequest, NextApiResponse } from "next";

const ENOKI_API_KEY = process.env.ENOKI_API_KEY;
const ENOKI_PROVER = "https://api.enoki.mystenlabs.com/v1/zklogin/zkp";
const DEV_PROVER   = "https://prover-dev.mystenlabs.com/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    let proverRes: Response;

    if (ENOKI_API_KEY) {
      // Enoki prover — correct circuit, works on testnet validators
      console.log("Using Enoki prover");
      proverRes = await fetch(ENOKI_PROVER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENOKI_API_KEY}`,
          "zklogin-jwt": body.jwt,
        },
        body: JSON.stringify({
          network: "testnet",
          randomness: body.jwtRandomness,
          maxEpoch: body.maxEpoch,
          ephemeralPublicKey: body.extendedEphemeralPublicKey,
          jwtRandomness: body.jwtRandomness,
        }),
      });
    } else {
      // Dev prover fallback
      console.log("Using dev prover (Groth16 may fail on testnet)");
      proverRes = await fetch(DEV_PROVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const text = await proverRes.text();
    console.log("Prover response:", proverRes.status, text.slice(0, 300));

    if (!proverRes.ok) {
      return res.status(proverRes.status).json({ error: text });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Prover error:", msg);
    return res.status(500).json({ error: msg });
  }
}
