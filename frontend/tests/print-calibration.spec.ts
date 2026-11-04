// Unit tests for calibration offsets and the calibration sheet layout (pure, no browser pages).
import { expect, test } from "@playwright/test"
import { clampOffset, layoutCalibrationSheet, parseOffsets, MAX_OFFSET_PT } from "../src/lib/print/calibration"

test.describe("print calibration", () => {
  test("clamps offsets and replaces bad numbers with 0", () => {
    expect(clampOffset({ x: 100, y: -100 })).toEqual({ x: MAX_OFFSET_PT, y: -MAX_OFFSET_PT })
    expect(clampOffset({ x: 1.234, y: Number.NaN })).toEqual({ x: 1.2, y: 0 })
  })

  test("parses saved offsets defensively", () => {
    expect(parseOffsets(null)).toEqual({})
    expect(parseOffsets("not json")).toEqual({})
    expect(parseOffsets("[1,2]")).toEqual({})
    expect(parseOffsets(JSON.stringify({ clearance: { x: 2, y: -1 }, utility: { x: "a", y: 1 }, bogus: { x: 1, y: 1 }, indigency: { x: 99, y: 0 } })))
      .toEqual({ clearance: { x: 2, y: -1 }, indigency: { x: MAX_OFFSET_PT, y: 0 } })
  })

  test("outlines fields, marks and photo at the offset, centring centred fields", () => {
    const [page] = layoutCalibrationSheet("clearance", { x: 2, y: 3 })
    const date = page.fields.find((f) => f.label === "date")!
    expect(date).toMatchObject({ x: 491 - 172 / 2 + 2, y: 199 + 3, w: 172 })
    expect(page.photo).toMatchObject({ x: 403, y: 342, w: 84, h: 81 })
    const [utility] = layoutCalibrationSheet("utility")
    expect(utility.marks[0]).toMatchObject({ label: "electric=yes", x: 216.9 - 4, y: 344.7 - 4, w: 8, h: 8 })
  })

  test("grid covers the Letter page every 36 pt and multi-sheet templates use their own page", () => {
    const [page] = layoutCalibrationSheet("assistance")
    expect(page.page).toBe(1)
    expect(page.vLines[0]).toBe(0)
    expect(page.vLines.at(-1)).toBe(612)
    expect(page.hLines.at(-1)).toBe(792)
  })
})
