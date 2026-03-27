"use client";

import { useEffect, useState } from "react";
import { fetchAllCampaigns } from "@/utils/sui";
import type { CampaignOnChain } from "@/utils/sui";
import CampaignCard from "@/components/CampaignCard";
import { useZkLogin } from "@/context/ZkLoginContext";
import Link from "next/link";

export default function HomePage() {
  const { session } = useZkLogin();
  const [campaigns, setCampaigns] = useState<CampaignOnChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllCampaigns()
      .then(setCampaigns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold mb-4">
          Decentralized Donations on{" "}
          <span className="text-[#4DA2FF]">Sui</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Create campaigns, upload proof images via Walrus, and receive donations
          transparently on-chain.
        </p>
        {!session && (
          <p className="mt-6 text-sm text-gray-500">
            Sign in with Google (zkLogin) to create a campaign.
          </p>
        )}
        {session && (
          <Link
            href="/campaigns/create"
            className="mt-6 inline-block bg-[#4DA2FF] hover:bg-blue-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Start a Campaign
          </Link>
        )}
      </div>

      {/* Campaign feed */}
      <h2 className="text-xl font-semibold mb-6">Active Campaigns</h2>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl h-72 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-center py-8">
          Failed to load campaigns: {error}
        </p>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p>No campaigns yet. Be the first to create one.</p>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
