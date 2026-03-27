import type { NextApiRequest, NextApiResponse } from "next";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, endpoint: "PUT /api/upload" });
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType =
      (req.headers["content-type"] as string) ?? "application/octet-stream";

    // Convert body to Uint8Array — compatible with fetch BodyInit
    let bodyBytes: Uint8Array;
    if (Buffer.isBuffer(req.body)) {
      bodyBytes = new Uint8Array(req.body);
    } else if (typeof req.body === "string") {
      bodyBytes = new TextEncoder().encode(req.body);
    } else {
      bodyBytes = new Uint8Array(Buffer.from(JSON.stringify(req.body)));
    }

    if (bodyBytes.length === 0) {
      return res.status(400).json({ error: "Empty file" });
    }

    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/store?epochs=5`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bodyBytes,
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
