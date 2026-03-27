/**
 * Server-side proxy for Walrus uploads.
 *
 * The browser sends the image to this Next.js API route.
 * The server (running on Vercel) forwards it to the Walrus publisher.
 * This avoids ERR_CERT_AUTHORITY_INVALID errors that occur when the
 * browser tries to directly connect to the Walrus testnet endpoint.
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

    const walrusRes = await fetch(
      `${WALRUS_PUBLISHER}/v1/store?epochs=${EPOCHS}`,
      {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      }
    );

    const data = await walrusRes.json();

    if (!walrusRes.ok) {
      return NextResponse.json(
        { error: `Walrus error: ${JSON.stringify(data)}` },
        { status: walrusRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
