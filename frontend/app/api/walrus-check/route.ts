/**
 * Debug endpoint — checks if the Walrus publisher is reachable from Vercel.
 * Visit /api/walrus-check in browser to see the result.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ?? "https://publisher.walrus-testnet.walrus.space";
  try {
    const res = await fetch(`${url}/v1/api`, { method: "GET" });
    const text = await res.text();
    return NextResponse.json({ status: res.status, ok: res.ok, body: text.slice(0, 500), url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), url }, { status: 502 });
  }
}
