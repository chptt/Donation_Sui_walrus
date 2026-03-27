"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useZkLogin } from "@/context/ZkLoginContext";
import { suiClient, mistToSui } from "@/utils/sui";

export default function Navbar() {
  const { session, login, logout, isLoading } = useZkLogin();
  const [balance, setBalance] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  // Fetch wallet balance whenever session changes
  useEffect(() => {
    if (!session) { setBalance(null); return; }
    suiClient
      .getBalance({ owner: session.address })
      .then((b) => setBalance(mistToSui(BigInt(b.totalBalance)).toFixed(3)))
      .catch(() => setBalance("—"));
  }, [session]);

  // Request testnet coins from the Sui faucet
  const requestFaucet = async () => {
    if (!session) return;
    setFaucetLoading(true);
    setFaucetMsg(null);
    try {
      const res = await fetch("https://faucet.testnet.sui.io/v1/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FixedAmountRequest: { recipient: session.address } }),
      });
      if (res.ok) {
        setFaucetMsg("Test coins sent! Balance will update shortly.");
        // Refresh balance after a short delay
        setTimeout(() => {
          suiClient
            .getBalance({ owner: session.address })
            .then((b) => setBalance(mistToSui(BigInt(b.totalBalance)).toFixed(3)))
            .catch(() => {});
        }, 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setFaucetMsg(data?.error ?? "Faucet request failed. Try again later.");
      }
    } catch {
      setFaucetMsg("Could not reach faucet. Check your connection.");
    } finally {
      setFaucetLoading(false);
      setTimeout(() => setFaucetMsg(null), 6000);
    }
  };

  const shortAddress = session
    ? `${session.address.slice(0, 6)}...${session.address.slice(-4)}`
    : null;

  return (
    <nav className="border-b border-gray-800 bg-[#0d1117] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[#4DA2FF]">
          ⭐ Star Donation
        </Link>

        <div className="flex items-center gap-3">
          {session && (
            <Link
              href="/campaigns/create"
              className="bg-[#4DA2FF] hover:bg-blue-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              + New Campaign
            </Link>
          )}

          {isLoading ? (
            <div className="w-24 h-9 bg-gray-700 rounded-lg animate-pulse" />
          ) : session ? (
            <div className="flex items-center gap-2">
              {/* Balance + faucet */}
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500 font-mono">{shortAddress}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#4DA2FF] font-semibold">
                    {balance !== null ? `${balance} SUI` : "..."}
                  </span>
                  <button
                    onClick={requestFaucet}
                    disabled={faucetLoading}
                    title="Request free test coins"
                    className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-2 py-0.5 rounded transition-colors"
                  >
                    {faucetLoading ? "..." : "+ Coins"}
                  </button>
                </div>
                {faucetMsg && (
                  <span className="text-xs text-green-400 mt-0.5">{faucetMsg}</span>
                )}
              </div>

              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
