"use client";

/**
 * ImageUpload component.
 * Handles file selection, preview, and Walrus upload.
 * The parent receives the blobId once upload succeeds.
 */

import { useState, useRef, useCallback } from "react";
import { uploadToWalrus } from "@/utils/walrus";

interface Props {
  onUploadComplete: (blobId: string) => void;
  onUploadError: (error: string) => void;
}

export default function ImageUpload({ onUploadComplete, onUploadError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedBlobId, setUploadedBlobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onUploadError("Please select an image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        onUploadError("Image must be under 10 MB.");
        return;
      }

      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      setUploading(true);
      setUploadedBlobId(null);

      try {
        // Upload to Walrus — returns blobId + aggregator URL
        const { blobId } = await uploadToWalrus(file);
        setUploadedBlobId(blobId);
        onUploadComplete(blobId);
      } catch (err) {
        onUploadError(err instanceof Error ? err.message : "Upload failed");
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete, onUploadError]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-600 hover:border-[#4DA2FF] rounded-xl p-8 text-center cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[#4DA2FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Uploading to Walrus...</p>
          </div>
        ) : preview ? (
          <p className="text-sm text-gray-400">Click to change image</p>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-300">Drop image here or click to browse</p>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10 MB — stored on Walrus</p>
          </div>
        )}
      </div>

      {/* Preview — shown after file is selected */}
      {preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Campaign preview"
            className="w-full h-56 object-cover rounded-xl border border-gray-700"
          />
          {uploadedBlobId && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded-lg px-3 py-1.5">
              <p className="text-xs text-green-400 font-mono truncate">
                ✓ Walrus blob: {uploadedBlobId}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
