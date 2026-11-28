// Unit tests for the pure print overlay layout (no browser pages).
import { expect, test } from "@playwright/test"
import type { PrintData } from "../src/lib/print/buildPrintData"
import { fitFontSize, layoutOverlay } from "../src/lib/print/overlayLayout"

const measure = (text: string, size: number) => text.length * size * 0.5 // fake 0.5 em per character

test.describe("print overlay layout", () => {
  test("fitFontSize keeps the size when it fits and shrinks to the width otherwise", () => {
    expect(fitFontSize("abcd", 100, 11, measure)).toBe(11)
    expect(fitFontSize("abcd", undefined, 11, measure)).toBe(11)
    expect(fitFontSize("a".repeat(40), 110, 11, measure)).toBe(7) // would need 5.5 pt, clamped to the 7 pt minimum
    expect(fitFontSize("a".repeat(30), 120, 11, measure)).toBe(8)
  })

  test("skips empty values, applies the offset and centres the date", () => {
    const data: PrintData = {
      templateId: "indigency",
      values: {
        date: "November 4, 2026",
        name: "JUAN DELA CRUZ",
        address: "  ",
      },
    }
    const [page] = layoutOverlay(data, measure, { x: 2, y: -3 })
    expect(page.texts.map((t) => t.key)).toEqual(["date", "name"])
    expect(page.texts[0]).toMatchObject({ x: 493, y: 217, align: "center" })
    expect(page.texts[1]).toMatchObject({ x: 137, y: 340.6, align: "left" })
  })

  test("a field with a prefix prints the words before the value, and nothing when the value is empty", () => {
    const [filled] = layoutOverlay(
      { templateId: "indigency", values: { addressedTo: "CHED" } },
      measure,
    )
    expect(filled.texts[0]).toMatchObject({
      key: "addressedTo",
      text: "Addressed to the office of CHED",
      font: "note",
      size: 10,
    })
    const [empty] = layoutOverlay(
      { templateId: "indigency", values: { addressedTo: "  ", name: "X" } },
      measure,
    )
    expect(empty.texts.map((t) => t.key)).toEqual(["name"])
  })

  test("prints a mark only in the matching box", () => {
    const data: PrintData = {
      templateId: "utility",
      values: {
        electric: "yes",
        water: "",
        connectionType: "Reconnection",
        classification: "Residential",
      },
    }
    const [page] = layoutOverlay(data, measure)
    expect(page.marks).toEqual([
      { key: "electric", x: 216.7, y: 345.7 },
      { key: "connectionType", x: 330.1, y: 416.8 },
      { key: "classification", x: 221.4, y: 435.6 },
    ])
  })

  test("renders only the sheet that has content and places the photo", () => {
    const assistance = layoutOverlay(
      { templateId: "assistance", values: { name: "JUAN", for: "Myself" } },
      measure,
    )
    expect(assistance.map((p) => p.page)).toEqual([1])
    expect(assistance[0].marks).toEqual([{ key: "for", x: 395.5, y: 383.2 }])
    const clearance = layoutOverlay(
      {
        templateId: "clearance",
        values: { name: "X" },
        photoUrl: "data:image/png;base64,AAA",
      },
      measure,
      { x: 1, y: 1 },
    )
    expect(clearance[0].photo).toEqual({
      url: "data:image/png;base64,AAA",
      x: 403,
      y: 326,
      w: 82,
      h: 79,
    })
    // Jobseeker (patch 341): the photo goes on the Applicant sheet only, under the signature.
    const jobseeker = layoutOverlay(
      {
        templateId: "jobseeker",
        values: { name: "X", witnessName: "Y" },
        photoUrl: "data:x",
      },
      measure,
    )
    expect(jobseeker.map((p) => p.photo !== undefined)).toEqual([
      true,
      false,
      false,
    ])
    expect(jobseeker[0].photo).toMatchObject({ x: 107.6, y: 692.6 })
    expect(
      layoutOverlay(
        { templateId: "indigency", values: { name: "X" }, photoUrl: "data:x" },
        measure,
      )[0].photo,
    ).toBeUndefined()
  })

  test("clearance, franchise and utility print the stamp box; the others do not", () => {
    const values = {
      stampOr: "0359328",
      stampDate: "09/15/2026",
      stampBy: "KRGV",
    }
    for (const templateId of ["clearance", "franchise", "utility"] as const) {
      const [page] = layoutOverlay({ templateId, values }, measure)
      expect(page.stamp?.title).toBe('"DOCUMENTARY STAMP TAX PAID"')
      expect(page.stamp?.rows.map((row) => row.value)).toEqual([
        "0359328",
        "09/15/2026",
        "KRGV",
      ])
    }
    const [other] = layoutOverlay({ templateId: "indigency", values }, measure)
    expect(other.stamp).toBeUndefined()
  })

  test("the stamp box prints even before a receipt is typed, and follows the calibration offset", () => {
    const [page] = layoutOverlay(
      { templateId: "clearance", values: {} },
      measure,
      { x: 2, y: -3 },
    )
    expect(page.stamp).toMatchObject({ x: 400 + 2, y: 612 - 3 })
    expect(page.stamp?.rows.every((row) => row.value === "")).toBe(true)
  })

  test("every First-Time Jobseeker value is in the form font (Verdana), the others in the value font", () => {
    const jobseeker = layoutOverlay(
      {
        templateId: "jobseeker",
        values: { name: "A", witnessName: "B", date: "C" },
      },
      measure,
    )
    const fonts = jobseeker.flatMap((p) => p.texts.map((t) => t.font))
    expect(fonts.length).toBeGreaterThan(0)
    expect(new Set(fonts)).toEqual(new Set(["form"]))
    const residency = layoutOverlay(
      { templateId: "indigency", values: { name: "X" } },
      measure,
    )
    expect(residency[0].texts[0].font).toBe("value")
  })

  test("the Indigency SECTOR line: label and colon in the label font, value in the value font", () => {
    const [page] = layoutOverlay(
      { templateId: "indigency", values: { sectorLabel: "SECTOR", sectorColon: ":", sector: "Urban Poor" } },
      measure,
    )
    const by = (key: string) => page.texts.find((t) => t.key === key)
    expect(by("sectorLabel")).toMatchObject({ x: 51, y: 403.2, font: "label" })
    expect(by("sectorColon")).toMatchObject({ x: 123.5, y: 403.2, font: "label" })
    expect(by("sector")).toMatchObject({ x: 135, y: 402, font: "value" })
  })

  test("an empty sector prints no label or colon", () => {
    const [page] = layoutOverlay(
      { templateId: "indigency", values: { name: "JUAN", sectorLabel: "", sectorColon: "", sector: "" } },
      measure,
    )
    expect(page.texts.map((t) => t.key)).toEqual(["name"])
  })
})
