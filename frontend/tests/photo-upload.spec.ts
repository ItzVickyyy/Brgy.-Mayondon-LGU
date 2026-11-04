// Unit tests for the photo upload file check (pure, no browser pages).
import { expect, test } from "@playwright/test"
import { PHOTO_UPLOAD_MAX_BYTES, validatePhotoFile } from "../src/lib/photo-upload"

test.describe("validatePhotoFile", () => {
  test("accepts JPG, PNG and WebP pictures", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(validatePhotoFile({ type, size: 1024 })).toBeNull()
  })

  test("accepts a file exactly at the size limit", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: PHOTO_UPLOAD_MAX_BYTES })).toBeNull()
  })

  test("rejects files that are not supported pictures", () => {
    for (const type of ["application/pdf", "image/gif", "image/heic", "image/svg+xml", ""]) {
      expect(validatePhotoFile({ type, size: 1024 })).toContain("JPG, PNG or WebP")
    }
  })

  test("rejects empty and oversized files", () => {
    expect(validatePhotoFile({ type: "image/png", size: 0 })).toContain("could not be opened")
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_UPLOAD_MAX_BYTES + 1 })).toContain("too large")
  })
})
