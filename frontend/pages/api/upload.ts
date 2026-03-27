/**
 * Pages Router API route for Walrus upload proxy.
 * Using pages/api instead of app/api for better Vercel compatibility.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, endpoint: "PUT /api/upload" });
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = (req.headers["content-type"] as string) ?? "application/octet-stream";

    // req.body is already parsed as Buffer when bodyParser is enabled
    const body: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body);

    if (!body || body.length === 0) {
      return res.status(400).json({ error: "Empty file" });
    }

    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/store?epochs=5`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });

    const text = await walrusRes.text();

    if (!walrusRes.ok) {
      return res.status(walrusRes.status).json({
        error: `Walrus ${walrusRes.status}: ${text.slice(0, 300)}`,
      });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload error:", msg);
    return res.status(500).json({ error: msg });
  }
}
