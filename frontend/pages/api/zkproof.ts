import type { NextApiRequest, NextApiResponse } from "next";

const ENOKI_API_KEY    = process.env.ENOKI_API_KEY;
const ENOKI_PUBLIC_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
const ENOKI_PROVER     = "https://api.enoki.mystenlabs.com/v1/zklogin/zkp";
const DEV_PROVER       = "https://prover-dev.mystenlabs.com/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body;
  const apiKey = ENOKI_API_KEY || ENOKI_PUBLIC_KEY;

  try {
    let proverRes: Response;

    if (apiKey) {
      console.log("Using Enoki prover, key prefix:", apiKey.slice(0, 25));
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
    console.log("Prover HTTP status:", proverRes.status);
    console.log("Prover raw body:", text.slice(0, 600));

    if (!proverRes.ok) {
      return res.status(proverRes.status).json({ error: `Prover ${proverRes.status}: ${text}` });
    }

    const raw = JSON.parse(text);
    console.log("Prover top-level keys:", Object.keys(raw));

    // Enoki wraps in { data: { proofPoints, issBase64Details, headerBase64 } }
    // Dev prover returns { proofPoints, issBase64Details, headerBase64 } directly
    const proof = raw?.data ?? raw;

    console.log("Proof keys:", proof ? Object.keys(proof) : "null");

    if (!proof?.proofPoints) {
      console.error("No proofPoints in response:", JSON.stringify(raw).slice(0, 400));
      return res.status(500).json({
        error: "Prover returned unexpected structure. Keys: " + Object.keys(raw).join(", "),
        raw: JSON.stringify(raw).slice(0, 400),
      });
    }

    return res.status(200).json(proof);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Prover proxy error:", msg);
    return res.status(500).json({ error: msg });
  }
}
