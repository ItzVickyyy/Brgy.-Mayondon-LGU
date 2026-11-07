// Checks that the English and Filipino strings stay in step. No browser needed.
import { expect, test } from "@playwright/test"
import en from "../src/i18n/en.json" with { type: "json" }
import fil from "../src/i18n/fil.json" with { type: "json" }

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value }
  const out: Record<string, string> = {}
  for (const [key, child] of Object.entries(value as object)) {
    Object.assign(out, flatten(child, prefix ? `${prefix}.${key}` : key))
  }
  return out
}

const placeholders = (text: string) =>
  (text.match(/{{\s*[\w.]+\s*}}/g) ?? [])
    .map((p) => p.replace(/\s/g, ""))
    .sort()

test.describe("translations", () => {
  const english = flatten(en)
  const filipino = flatten(fil)

  test("Filipino has exactly the same keys as English", () => {
    expect(Object.keys(filipino).sort()).toEqual(Object.keys(english).sort())
  })

  test("no translation is empty", () => {
    for (const [key, text] of [
      ...Object.entries(english),
      ...Object.entries(filipino),
    ]) {
      expect(text.trim(), key).not.toBe("")
    }
  })

  test("placeholders match between languages", () => {
    for (const key of Object.keys(english)) {
      expect(placeholders(filipino[key]), key).toEqual(
        placeholders(english[key]),
      )
    }
  })
})
