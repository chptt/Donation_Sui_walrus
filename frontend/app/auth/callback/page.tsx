"use client";

/**
 * OAuth callback page.
 * Google redirects here after the user authenticates.
 * We extract the JWT from the URL hash, call the zkLogin prover,
 * and store the session before redirecting home.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { handleZkLoginCallback } from "@/utils/zklogin";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign-in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleZkLoginCallback()
      .then((session) => {
        if (!session) {
          setError("No JWT found in callback URL. Please try logging in again.");
          return;
        }
        setStatus("Sign-in successful! Redirecting...");
        // Small delay so the user sees the success message
        setTimeout(() => router.replace("/"), 1000);
      })
      .catch((err) => {
        console.error("zkLogin callback error:", err);
        setError(err.message ?? "Authentication failed. Please try again.");
      });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      {!error ? (
        <>
          <div className="w-10 h-10 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300">{status}</p>
        </>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="text-[#4DA2FF] underline text-sm"
          >
            Go home
          </button>
        </div>
      )}
    </div>
  );
}
