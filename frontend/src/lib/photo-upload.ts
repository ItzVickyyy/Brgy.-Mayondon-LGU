/** Checks for a picture file chosen with "Upload photo" (pure, so it can be unit-tested). */

export const PHOTO_UPLOAD_MAX_BYTES = 15 * 1024 * 1024
export const PHOTO_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp"

const allowedTypes = PHOTO_UPLOAD_ACCEPT.split(",")

export const PHOTO_UPLOAD_OPEN_ERROR = "This picture could not be opened. Please choose a JPG, PNG or WebP photo."

/** Returns a message the person can act on, or `null` when the file can be used. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!allowedTypes.includes(file.type)) return "Please choose a JPG, PNG or WebP picture."
  if (file.size <= 0) return PHOTO_UPLOAD_OPEN_ERROR
  if (file.size > PHOTO_UPLOAD_MAX_BYTES) return "This picture is too large. Please choose one under 15 MB."
  return null
}
