/**
 * ZK Proof proxy.
 * Routes to Enoki (if ENOKI_API_KEY set) or dev prover.
 * Always returns the same normalized shape:
 * { proofPoints, issBase64Details, headerBase64 }
 */
import type { NextApiRequest, NextApiResponse } from "next";

const ENOKI_API_KEY = process.env.ENOKI_API_KEY;
const ENOKI_PUBLIC_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
const ENOKI_PROVER  = "https://api.enoki.mystenlabs.com/v1/zklogin/zkp";
const DEV_PROVER    = "https://prover-dev.mystenlabs.com/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    let proverRes: Response;

    if (ENOKI_API_KEY || ENOKI_PUBLIC_KEY) {
      const apiKey = ENOKI_API_KEY || ENOKI_PUBLIC_KEY;
      console.log("Using Enoki prover with key:", apiKey?.slice(0, 20) + "...");
      proverRes = await fetch(ENOKI_PROVER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "zklogin-jwt": body.jwt,
        },
        body: JSON.stringify({
          network: "testnet",
          randomness: body.jwtRandomness,
          maxEpoch: body.maxEpoch,
          ephemeralPublicKey: body.extendedEphemeralPublicKey,
        }),
      });
    } else {
      console.log("Using dev prover");
      proverRes = await fetch(DEV_PROVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const text = await proverRes.text();
    console.log("Prover status:", proverRes.status, "body:", text.slice(0, 400));

    if (!proverRes.ok) {
      return res.status(proverRes.status).json({ error: text });
    }

    const raw = JSON.parse(text);

    // Normalize: Enoki wraps in { data: { proofPoints, issBase64Details, headerBase64 } }
    // Dev prover returns { proofPoints, issBase64Details, headerBase64 } directly
    const proof = raw?.data ?? raw;

    if (!proof?.proofPoints) {
      console.error("Unexpected prover response shape:", JSON.stringify(raw));
      return res.status(500).json({ error: "Prover returned unexpected shape: " + text.slice(0, 200) });
    }

    return res.status(200).json(proof);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Prover proxy error:", msg);
    return res.status(500).json({ error: msg });
  }
}
