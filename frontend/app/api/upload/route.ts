/**
 * Server-side proxy for Walrus uploads.
 * Forwards image bytes from the browser to the Walrus publisher.
 * Avoids ERR_CERT_AUTHORITY_INVALID that occurs in browsers on testnet.
 */

import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

const EPOCHS = 5;

export async function PUT(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "application/octet-stream";
    const body = await req.arrayBuffer();

    if (body.byteLength === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    let walrusRes: Response;
    try {
      walrusRes = await fetch(
        `${WALRUS_PUBLISHER}/v1/store?epochs=${EPOCHS}`,
        {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body,
          // @ts-expect-error - Node fetch supports this
          duplex: "half",
        }
      );
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("Walrus fetch error:", msg);
      return NextResponse.json(
        { error: `Could not reach Walrus publisher: ${msg}` },
        { status: 502 }
      );
    }

    const text = await walrusRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Walrus non-JSON response:", text);
      return NextResponse.json(
        { error: `Walrus returned unexpected response: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    if (!walrusRes.ok) {
      return NextResponse.json(
        { error: `Walrus error ${walrusRes.status}: ${text.slice(0, 200)}` },
        { status: walrusRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
