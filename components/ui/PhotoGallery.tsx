"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "./button";

export interface GalleryPhoto {
  id: string;
  file_path: string;
  caption: string | null;
  publicUrl: string;
}

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  isEditable?: boolean;
  onDeletePhoto?: (photoId: string, type: "worker" | "flipper") => Promise<void>;
  userType: "worker" | "flipper";
}

export function PhotoGallery({
  photos,
  isEditable = false,
  onDeletePhoto,
  userType,
}: PhotoGalleryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (photoId: string) => {
    if (!onDeletePhoto) return;

    setDeletingId(photoId);
    try {
      await onDeletePhoto(photoId, userType);
    } catch (error) {
      console.error("Failed to delete photo:", error);
      alert("Failed to delete photo. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center">
        <p className="text-sm text-stone-600">
          {isEditable
            ? "No photos yet. Upload your work to showcase what you do."
            : "No photos yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
        >
          <div className="relative h-48 w-full bg-stone-100">
            <Image
              src={photo.publicUrl}
              alt={photo.caption || "Work sample"}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
          <div className="p-4">
            {photo.caption && (
              <p className="mb-3 text-sm text-stone-700">{photo.caption}</p>
            )}
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {deletingId === photo.id ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
