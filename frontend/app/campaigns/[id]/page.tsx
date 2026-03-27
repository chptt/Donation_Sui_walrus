"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { fetchCampaign, donateTx, mistToSui, suiToMist } from "@/utils/sui";
import { getWalrusImageUrl } from "@/utils/walrus";
import { useZkLogin } from "@/context/ZkLoginContext";
import type { CampaignOnChain } from "@/utils/sui";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : null;
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
      setDonateError("Please enter a valid amount.");
      return;
    }

    setDonating(true);
    try {
      const digest = await donateTx(session, campaign.id, suiToMist(amount));
      setDonateSuccess(`Thank you! Your donation was sent. (Ref: ${digest.slice(0, 12)}...)`);
      setDonateAmount("");
      const updated = await fetchCampaign(campaign.id);
      if (updated) setCampaign(updated);
    } catch (err) {
      setDonateError(err instanceof Error ? err.message : "Donation failed. Please try again.");
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
    return <p className="text-center text-red-400 py-20">{error ?? "Campaign not found."}</p>;
  }

  const raised = mistToSui(campaign.amountRaised);
  const target = mistToSui(campaign.targetAmount);
  const progress = target > 0 ? Math.min((raised / target) * 100, 100) : 0;
  const imageUrl = getWalrusImageUrl(campaign.walrusBlobId);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Campaign photo */}
      <div className="relative h-72 w-full rounded-2xl overflow-hidden bg-gray-800">
        <Image
          src={imageUrl}
          alt={campaign.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          {!campaign.isActive && (
            <span className="shrink-0 bg-gray-700 text-gray-400 text-sm px-3 py-1 rounded-full">
              Closed
            </span>
          )}
        </div>

        <p className="text-gray-400 leading-relaxed">{campaign.description}</p>

        <p className="text-xs text-gray-500">
          Created by: <span className="font-mono">{campaign.creator.slice(0, 10)}...{campaign.creator.slice(-6)}</span>
        </p>
      </div>

      {/* Progress */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#4DA2FF] font-semibold text-lg">
            {raised.toFixed(3)} SUI raised
          </span>
          <span className="text-gray-400">Goal: {target.toFixed(3)} SUI</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4DA2FF] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500">{progress.toFixed(1)}% of goal reached</p>
      </div>

      {/* Donate */}
      {campaign.isActive && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Support this Campaign</h2>
          <p className="text-sm text-gray-400 mb-4">
            Your donation goes directly to the campaign creator.
          </p>

          {!session ? (
            <p className="text-gray-400 text-sm">
              Sign in with Google to make a donation.
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

              {donateError && <p className="text-red-400 text-sm">{donateError}</p>}
              {donateSuccess && <p className="text-green-400 text-sm">{donateSuccess}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
