import type { NextApiRequest, NextApiResponse } from "next";

const FAUCET_URL = "https://faucet.testnet.sui.io/v1/gas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.body as { address?: string };
  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  try {
    const faucetRes = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ FixedAmountRequest: { recipient: address } }),
    });

    const data = await faucetRes.json().catch(() => ({}));

    if (!faucetRes.ok) {
      return res.status(faucetRes.status).json({
        error: faucetRes.status === 429
          ? "Faucet rate limit reached. Please wait a few minutes and try again."
          : data?.error ?? `Faucet error ${faucetRes.status}`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
