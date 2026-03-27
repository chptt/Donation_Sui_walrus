"use client";

import Link from "next/link";
import Image from "next/image";
import { getWalrusImageUrl } from "@/utils/walrus";
import { mistToSui } from "@/utils/sui";
import type { CampaignOnChain } from "@/utils/sui";

interface Props {
  campaign: CampaignOnChain;
}

export default function CampaignCard({ campaign }: Props) {
  const raised = mistToSui(campaign.amountRaised);
  const target = mistToSui(campaign.targetAmount);
  const progress = target > 0 ? Math.min((raised / target) * 100, 100) : 0;

  // Reconstruct the Walrus image URL from the blob ID stored on-chain
  const imageUrl = getWalrusImageUrl(campaign.walrusBlobId);

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-[#4DA2FF] transition-colors cursor-pointer">
        {/* Campaign image — served from Walrus aggregator */}
        <div className="relative h-48 w-full bg-gray-800">
          <Image
            src={imageUrl}
            alt={campaign.title}
            fill
            className="object-cover"
            unoptimized // Walrus URLs are external; skip Next.js image optimization
          />
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-lg truncate">{campaign.title}</h3>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">
            {campaign.description}
          </p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#4DA2FF] font-medium">{raised.toFixed(2)} SUI raised</span>
              <span className="text-gray-500">of {target.toFixed(2)} SUI</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4DA2FF] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {!campaign.isActive && (
            <span className="mt-3 inline-block text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
              Closed
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
