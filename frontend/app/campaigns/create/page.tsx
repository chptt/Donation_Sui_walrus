"use client";

/**
 * Create Campaign page.
 *
 * Flow:
 * 1. User fills in title, description, target amount.
 * 2. User uploads an image — ImageUpload sends it to Walrus and returns the blobId.
 *    The form submit is BLOCKED until a blobId exists (image is mandatory).
 * 3. On submit, createCampaignTx() stores the blobId permanently on-chain.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useZkLogin } from "@/context/ZkLoginContext";
import { createCampaignTx, suiToMist } from "@/utils/sui";
import ImageUpload from "@/components/ImageUpload";

export default function CreateCampaignPage() {
  const router = useRouter();
  const { session } = useZkLogin();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetSui, setTargetSui] = useState("");
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>You must be logged in to create a campaign.</p>
      </div>
    );
  }

  const handleUploadComplete = (blobId: string) => {
    setWalrusBlobId(blobId);
    setUploadError(null);
  };  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);

    // Mandatory image validation
    if (!walrusBlobId) {
      setUploadError("A campaign image is required. Please upload one.");
      return;
    }

    const target = parseFloat(targetSui);
    if (isNaN(target) || target <= 0) {
      setTxError("Please enter a valid target amount.");
      return;
    }

    setSubmitting(true);
    try {
      const digest = await createCampaignTx(session, {
        title: title.trim(),
        description: description.trim(),
        targetAmountMist: suiToMist(target),
        walrusBlobId, // stored on-chain as the Walrus image reference
      });
      console.log("Campaign created, tx digest:", digest);
      router.push("/");
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create a Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Campaign Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Help build a school in Kenya"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell donors what this campaign is about..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF] resize-none"
          />
        </div>

        {/* Target amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Target Amount (SUI) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            required
            min="0.1"
            step="0.1"
            value={targetSui}
            onChange={(e) => setTargetSui(e.target.value)}
            placeholder="e.g. 100"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DA2FF]"
          />
        </div>

        {/* Image upload — mandatory */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Campaign Image <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-500 font-normal">
              (stored on Walrus, reference saved on-chain)
            </span>
          </label>
          <ImageUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={setUploadError}
          />
          {uploadError && (
            <p className="mt-2 text-sm text-red-400">{uploadError}</p>
          )}
          {walrusBlobId && (
            <p className="mt-2 text-xs text-green-400">
              Image uploaded to Walrus. Blob ID will be stored on-chain.
            </p>
          )}
        </div>

        {txError && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
            {txError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !walrusBlobId}
          className="w-full bg-[#4DA2FF] hover:bg-blue-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? "Creating campaign..." : "Create Campaign"}
        </button>

        {!walrusBlobId && (
          <p className="text-center text-xs text-gray-500">
            Upload an image to enable campaign creation
          </p>
        )}
      </form>
    </div>
  );
}
