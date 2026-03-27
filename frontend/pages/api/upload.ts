import type { NextApiRequest, NextApiResponse } from "next";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

// Disable body parser — we need raw binary stream
export const config = {
  api: { bodyParser: false },
};

/** Read raw request body as a Buffer */
function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, endpoint: "PUT /api/upload" });
  }
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = (req.headers["content-type"] as string) ?? "application/octet-stream";
    const rawBody = await getRawBody(req);

    if (rawBody.length === 0) {
      return res.status(400).json({ error: "Empty file" });
    }

    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/store?epochs=5`, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(rawBody.length),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: rawBody as any,
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
