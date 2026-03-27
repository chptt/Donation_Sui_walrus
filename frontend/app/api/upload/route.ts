import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "PUT /api/upload" });
}

export async function PUT(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await req.arrayBuffer();

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/store?epochs=5`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: Buffer.from(buffer),
    });

    const text = await walrusRes.text();
    console.log("Walrus response:", walrusRes.status, text.slice(0, 200));

    if (!walrusRes.ok) {
      return NextResponse.json(
        { error: `Walrus ${walrusRes.status}: ${text.slice(0, 300)}` },
        { status: walrusRes.status }
      );
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
