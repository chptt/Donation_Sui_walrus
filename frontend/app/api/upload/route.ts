import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

export async function PUT(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "application/octet-stream";

    // Read body as Buffer — avoids duplex streaming issues on Vercel/Node
    const bytes = await req.bytes();

    if (!bytes || bytes.length === 0) {
      return NextResponse.json({ error: "Empty file received" }, { status: 400 });
    }

    const walrusRes = await fetch(
      `${WALRUS_PUBLISHER}/v1/store?epochs=5`,
      {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(bytes.length),
        },
        body: bytes,
      }
    );

    const text = await walrusRes.text();

    if (!walrusRes.ok) {
      console.error("Walrus error:", walrusRes.status, text);
      return NextResponse.json(
        { error: `Walrus ${walrusRes.status}: ${text.slice(0, 300)}` },
        { status: walrusRes.status }
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload proxy error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
