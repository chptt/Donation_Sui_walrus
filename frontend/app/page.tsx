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
          Make a Difference with{" "}
          <span className="text-[#4DA2FF]">Star Donation</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Start a fundraiser, share your story with photos, and receive support
          from people around the world — securely and transparently.
        </p>
        {!session && (
          <p className="mt-6 text-sm text-gray-500">
            Sign in with Google to create your first campaign.
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

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
        {[
          { icon: "📸", title: "Add a photo", desc: "Upload a proof image with your campaign. Photos are stored securely and permanently." },
          { icon: "🌍", title: "Share your cause", desc: "Tell your story and set a fundraising goal. Anyone can find and support your campaign." },
          { icon: "💸", title: "Receive donations", desc: "Supporters send SUI coins directly to you. Every transaction is recorded and visible." },
        ].map((item) => (
          <div key={item.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">{item.icon}</div>
            <h3 className="font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-gray-400">{item.desc}</p>
          </div>
        ))}
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
