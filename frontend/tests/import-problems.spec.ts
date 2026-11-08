// Row problem messages from the server are shown in the chosen language.
// No browser needed.
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { createInstance } from "i18next"
import { importProblemText } from "../src/lib/importProblems"

const load = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../src/i18n/${name}.json`, import.meta.url), "utf8"),
  )

async function translator(lng: "en" | "fil") {
  const i18n = createInstance()
  await i18n.init({
    lng,
    resources: {
      en: { translation: load("en") },
      fil: { translation: load("fil") },
    },
    interpolation: { escapeValue: false },
  })
  return i18n.t.bind(i18n)
}

const samples: [string, string][] = [
  ["Street is not in the streets list", "Street is not in the streets list"],
  ["Date not recognised", "Date not recognised"],
  [
    "ID number appears twice in the file",
    "ID number appears twice in the file",
  ],
  ["birthdate cannot be in the future", "Birthdate cannot be in the future"],
  ["Field required", "A value is required"],
  [
    "String should have at most 100 characters",
    "Too long (at most 100 characters)",
  ],
  [
    "Input should be 'Male' or 'Female'",
    "Not an allowed value. Use: Male, Female",
  ],
  [
    "Input should be 'Single', 'Married', 'Legally Separated' or 'Widow/Widower'",
    "Not an allowed value. Use: Single, Married, Legally Separated, Widow/Widower",
  ],
  ["Input should be greater than 0", "Must be greater than 0"],
  ["Input should be less than or equal to 32767", "Must be 32767 or less"],
  ["Input should be greater than or equal to 1900", "Must be 1900 or more"],
  [
    "Input should be a valid integer, unable to parse string as an integer",
    "Must be a whole number",
  ],
]

test("known problems read well in English", async () => {
  const t = await translator("en")
  for (const [server, shown] of samples) {
    expect(importProblemText(server, t as never)).toBe(shown)
  }
})

test("known problems are translated in Filipino and unknown text is kept", async () => {
  const t = await translator("fil")
  for (const [server, shown] of samples) {
    expect(importProblemText(server, t as never)).not.toBe(shown)
  }
  expect(importProblemText("Something new from the server", t as never)).toBe(
    "Something new from the server",
  )
})
