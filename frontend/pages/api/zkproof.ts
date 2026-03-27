/**
 * Debug proxy for the ZK prover — logs the full response so we can
 * see exactly what fields the prover returns (including addressSeed).
 */
import type { NextApiRequest, NextApiResponse } from "next";

const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = req.body;
    console.log("Prover request body:", JSON.stringify(body));

    const proverRes = await fetch(PROVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await proverRes.text();
    console.log("Prover raw response:", text);

    if (!proverRes.ok) {
      return res.status(proverRes.status).json({ error: text });
    }

    const data = JSON.parse(text);
    // Log all top-level keys so we know what the prover returns
    console.log("Prover response keys:", Object.keys(data));

    return res.status(200).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
