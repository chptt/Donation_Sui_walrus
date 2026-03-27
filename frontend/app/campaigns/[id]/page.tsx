"use client";

/**
 * Campaign detail page.
 * Fetches the campaign object from Sui, displays the image from Walrus,
 * and allows logged-in users to donate.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { fetchCampaign, donateTx, mistToSui, suiToMist } from "@/utils/sui";
import { getWalrusImageUrl } from "@/utils/walrus";
import { useZkLogin } from "@/context/ZkLoginContext";
import type { CampaignOnChain } from "@/utils/sui";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useZkLogin();

  const [campaign, setCampaign] = useState<CampaignOnChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  const [donateSuccess, setDonateSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCampaign(id)
      .then((c) => {
        if (!c) setError("Campaign not found.");
        else setCampaign(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !campaign) return;
    setDonateError(null);
    setDonateSuccess(null);

    const amount = parseFloat(donateAmount);
    if (isNaN(amount) || amount <= 0) {
      setDonateError("Enter a valid donation amount.");
      return;
    }

    setDonating(true);
    try {
      const digest = await donateTx(session, campaign.id, suiToMist(amount));
      setDonateSuccess(`Donation successful! Tx: ${digest.slice(0, 16)}...`);
      setDonateAmount("");
      // Refresh campaign data
      const updated = await fetchCampaign(campaign.id);
      if (updated) setCampaign(updated);
    } catch (err) {
      setDonateError(err instanceof Error ? err.message : "Donation failed");
    } finally {
      setDonating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !campaign) {
    return <p className="text-center text-red-400 py-20">{error ?? "Not found"}</p>;
  }

  const raised = mistToSui(campaign.amountRaised);
  const target = mistToSui(campaign.targetAmount);
  const progress = target > 0 ? Math.min((raised / target) * 100, 100) : 0;

  // Build the Walrus image URL from the blob ID stored on-chain
  const imageUrl = getWalrusImageUrl(campaign.walrusBlobId);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Campaign image — fetched from Walrus aggregator */}
      <div className="relative h-72 w-full rounded-2xl overflow-hidden bg-gray-800">
        <Image
          src={imageUrl}
          alt={campaign.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          {!campaign.isActive && (
            <span className="shrink-0 bg-gray-700 text-gray-400 text-sm px-3 py-1 rounded-full">
              Closed
            </span>
          )}
        </div>

        <p className="text-gray-400 leading-relaxed">{campaign.description}</p>

        {/* Creator */}
        <p className="text-xs text-gray-500 font-mono">
          Creator: {campaign.creator}
        </p>

        {/* Walrus blob ID — transparency */}
        <p className="text-xs text-gray-600 font-mono break-all">
          Image blob ID (Walrus): {campaign.walrusBlobId}
        </p>
      </div>

      {/* Progress */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#4DA2FF] font-semibold text-lg">
            {raised.toFixed(4)} SUI raised
          </span>
          <span className="text-gray-400">Goal: {target.toFixed(4)} SUI</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4DA2FF] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500">{progress.toFixed(1)}% funded</p>
      </div>

      {/* Donate form */}
      {campaign.isActive && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Make a Donation</h2>

          {!session ? (
            <p className="text-gray-400 text-sm">
              Sign in with Google (zkLogin) to donate.
            </p>
          ) : (
            <form onSubmit={handleDonate} className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  placeholder="Amount in SUI"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF]"
                />
                <button
                  type="submit"
                  disabled={donating}
                  className="bg-[#4DA2FF] hover:bg-blue-400 disabled:bg-gray-700 text-black disabled:text-gray-500 font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {donating ? "Sending..." : "Donate"}
                </button>
              </div>

              {donateError && (
                <p className="text-red-400 text-sm">{donateError}</p>
              )}
              {donateSuccess && (
                <p className="text-green-400 text-sm">{donateSuccess}</p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
