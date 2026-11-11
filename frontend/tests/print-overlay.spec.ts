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
    expect(page.texts[1]).toMatchObject({ x: 137, y: 338, align: "left" })
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
      { key: "electric", x: 216.9, y: 344.7 },
      { key: "connectionType", x: 330.1, y: 435.7 },
      { key: "classification", x: 221.4, y: 454.3 },
    ])
  })

  test("renders only the sheet that has content and places the photo", () => {
    const assistance = layoutOverlay(
      { templateId: "assistance", values: { name: "JUAN", for: "Myself" } },
      measure,
    )
    expect(assistance.map((p) => p.page)).toEqual([1])
    expect(assistance[0].marks).toEqual([{ key: "for", x: 395.5, y: 381.5 }])
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
      x: 402,
      y: 340,
      w: 84,
      h: 81,
    })
    expect(
      layoutOverlay(
        { templateId: "indigency", values: { name: "X" }, photoUrl: "data:x" },
        measure,
      )[0].photo,
    ).toBeUndefined()
  })
})
