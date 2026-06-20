"use client";

import { useState } from "react";
import { Button } from "./button";
import { compressImageForUpload, isAcceptableImageFile, looksLikeHeic } from "@/lib/imageCompression";

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

    // Validate file type (accepts HEIC too — iPhone default)
    if (!isAcceptableImageFile(selectedFile)) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // HEIC can't be rendered by the browser, so skip the preview.
    // The image will still convert + upload fine when the user submits.
    if (looksLikeHeic(selectedFile)) {
      setPreview(null);
      return;
    }

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

      // Compress big photos (phones) before uploading. Vercel caps function
      // bodies at 4.5MB.
      const fileToUpload = await compressImageForUpload(file);

      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      // Vercel's 413 returns HTML, not JSON — guard the parse.
      let data: { error?: string } = {};
      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.status === 413
            ? "Image is too large to upload even after compression. Try a smaller photo."
            : `Upload failed (server error ${response.status}).`
        );
      }

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
      className="space-y-4 rounded-lg border border-border bg-muted p-6"
    >
      <h3 className="text-sm font-semibold text-foreground">Upload Photo</h3>

      {/* File Input */}
      <div className="space-y-2">
        <label
          htmlFor="photo-upload"
          className="block text-sm font-medium text-foreground"
        >
          Photo
        </label>
        <input
          id="photo-upload"
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground hover:file:bg-accent/90"
        />
        <p className="text-xs text-muted-foreground">PNG, JPG, HEIC, or WebP. Max 10MB.</p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="overflow-hidden rounded-lg bg-card">
          <img
            src={preview}
            alt="Preview"
            className="h-40 w-full object-cover"
          />
        </div>
      )}

      {/* HEIC notice when no preview is shown */}
      {file && !preview && looksLikeHeic(file) && (
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          HEIC photo selected — your browser can&apos;t show a preview, but
          it will be converted to JPG when you upload.
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <label
          htmlFor="caption"
          className="block text-sm font-medium text-foreground"
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
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
