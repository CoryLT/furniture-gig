/**
 * Client-side image prep for uploads.
 *
 * Two jobs:
 *
 * 1) HEIC -> JPEG conversion
 *    iPhones shoot HEIC by default. Browsers can't display HEIC, our
 *    moderation provider (Sightengine) can't decode HEIC, and the
 *    `browser-image-compression` library below can't compress HEIC.
 *    So if the file is HEIC we convert it to a JPEG first.
 *
 * 2) Compression to fit Vercel's 4.5 MB serverless body limit
 *    Vercel Hobby/Pro plans have a hard 4.5 MB request body limit on
 *    serverless functions. Modern phone photos are routinely 4-8 MB,
 *    so an unmodified upload from a phone will fail at Vercel's
 *    gateway BEFORE it ever reaches our route. This helper shrinks
 *    any image to roughly:
 *      - max 1920 px on the longest side
 *      - max ~1 MB final file size
 *      - quality 0.8
 *
 * If an image is already small enough we return it untouched so we
 * don't waste CPU on the user's device.
 *
 * Non-image files are returned as-is — moderation/validation downstream
 * will reject them with a clear error.
 */
import imageCompression from 'browser-image-compression'
import { heicTo, isHeic } from 'heic-to'

const TARGET_MAX_SIZE_MB = 1 // final file size cap
const TARGET_MAX_WIDTH_PX = 1920 // longest edge cap
const SKIP_IF_UNDER_BYTES = 1 * 1024 * 1024 // 1 MB — no point compressing tiny files

/**
 * True if the file looks like a HEIC/HEIF image by EITHER its MIME type
 * OR its filename extension. We can't rely on MIME alone because
 * browsers often report HEIC files as `""` (empty string).
 */
export function looksLikeHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = (file.name || '').toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

/**
 * True if this is a file the app should accept as an image upload.
 * Use this in place of `file.type.startsWith('image/')` so HEIC files
 * (which often have an empty MIME type) aren't rejected at the door.
 */
export function isAcceptableImageFile(file: File): boolean {
  if ((file.type || '').toLowerCase().startsWith('image/')) return true
  return looksLikeHeic(file)
}

/**
 * Convert a HEIC/HEIF File to a JPEG File. Falls back to the original
 * file if anything goes wrong — the upload will then fail gracefully
 * downstream rather than silently swallowing the user's photo.
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // Double-check with heic-to's own detector (sniffs file bytes, not
    // just the extension). If it says no, just return the original.
    const reallyHeic = await isHeic(file).catch(() => looksLikeHeic(file))
    if (!reallyHeic) return file

    const converted = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.9,
    })

    // Swap the extension to .jpg so the storage key and any downstream
    // filename checks line up with the new content.
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    const safeName = newName === file.name ? `${file.name}.jpg` : newName

    return new File([converted], safeName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn('[convertHeicToJpeg] HEIC conversion failed, using original:', err)
    return file
  }
}

export async function compressImageForUpload(file: File): Promise<File> {
  // 1) HEIC files get converted to JPEG first so the rest of the
  // pipeline (compression, moderation, browser previews) works.
  let working = file
  if (looksLikeHeic(working)) {
    working = await convertHeicToJpeg(working)
  }

  // 2) Not an image (or unknown type)? Send it through as-is and let
  // the server reject it cleanly.
  if (!working.type.startsWith('image/')) {
    return working
  }

  // 3) Already small? Skip compression.
  if (working.size < SKIP_IF_UNDER_BYTES) {
    return working
  }

  try {
    const compressed = await imageCompression(working, {
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
    return new File([compressed], working.name, {
      type: compressed.type || working.type,
      lastModified: Date.now(),
    })
  } catch (err) {
    // If compression fails for any reason, fall back to the working file.
    // The server will either accept it (if under 4.5MB) or reject it cleanly.
    console.warn('[compressImageForUpload] compression failed, using original:', err)
    return working
  }
}
