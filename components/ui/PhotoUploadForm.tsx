"use client";

import { useState } from "react";
import { Button } from "./button";

interface PhotoUploadFormProps {
  onPhotoUploaded?: () => void;
  userType: "worker" | "flipper";
}

export function PhotoUploadForm({
  onPhotoUploaded,
  userType,
}: PhotoUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File must be less than 5MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const endpoint =
        userType === "worker"
          ? "/api/upload-worker-gallery-photo"
          : "/api/upload-flipper-gallery-photo";

      const formData = new FormData();
      formData.append("file", file);
      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setSuccess(true);
      setFile(null);
      setCaption("");
      setPreview(null);

      // Reset form
      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Notify parent to refresh
      if (onPhotoUploaded) {
        setTimeout(() => {
          onPhotoUploaded();
        }, 1500);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-6"
    >
      <h3 className="text-sm font-semibold text-stone-900">Upload Photo</h3>

      {/* File Input */}
      <div className="space-y-2">
        <label
          htmlFor="photo-upload"
          className="block text-sm font-medium text-stone-700"
        >
          Photo
        </label>
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-stone-500 file:mr-4 file:rounded file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-700"
        />
        <p className="text-xs text-stone-500">PNG, JPG, or WebP. Max 5MB.</p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="overflow-hidden rounded-lg bg-white">
          <img
            src={preview}
            alt="Preview"
            className="h-40 w-full object-cover"
          />
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <label
          htmlFor="caption"
          className="block text-sm font-medium text-stone-700"
        >
          Caption (Optional)
        </label>
        <textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe what's in this photo..."
          disabled={isUploading}
          rows={2}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Photo uploaded successfully!
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!file || isUploading}
        className="w-full"
      >
        {isUploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  );
}
