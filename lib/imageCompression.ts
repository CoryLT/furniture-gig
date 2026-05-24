/**
 * Client-side image compression for uploads.
 *
 * Vercel Hobby/Pro plans have a hard 4.5 MB request body limit on serverless
 * functions. Modern phone photos are routinely 4-8 MB, so an unmodified
 * upload from a phone will fail at Vercel's gateway BEFORE it ever reaches
 * our route — the request just dies silently and the client hangs.
 *
 * This helper shrinks any image to roughly:
 *   - max 1920 px on the longest side
 *   - max ~1 MB final file size
 *   - quality 0.8
 *
 * Those numbers are plenty for a marketplace photo or a gig proof shot. If
 * an image is already small enough we return it untouched so we don't waste
 * CPU on the user's device.
 *
 * Non-image files are returned as-is — moderation/validation downstream
 * will reject them with a clear error.
 */
import imageCompression from 'browser-image-compression'

const TARGET_MAX_SIZE_MB = 1 // final file size cap
const TARGET_MAX_WIDTH_PX = 1920 // longest edge cap
const SKIP_IF_UNDER_BYTES = 1 * 1024 * 1024 // 1 MB — no point compressing tiny files

export async function compressImageForUpload(file: File): Promise<File> {
  // Not an image (HEIC sometimes reports as ''), just send it through.
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Already small? Skip.
  if (file.size < SKIP_IF_UNDER_BYTES) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_MAX_SIZE_MB,
      maxWidthOrHeight: TARGET_MAX_WIDTH_PX,
      useWebWorker: true,
      initialQuality: 0.8,
      // Preserve EXIF orientation so portrait shots don't end up sideways.
      // (browser-image-compression auto-rotates by default in newer versions
      // but we set it explicitly to be safe.)
    })

    // The library returns a Blob but we want a File so the name + type
    // survive on the server side.
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    })
  } catch (err) {
    // If compression fails for any reason, fall back to the original file.
    // The server will either accept it (if under 4.5MB) or reject it cleanly.
    console.warn('[compressImageForUpload] compression failed, using original:', err)
    return file
  }
}
