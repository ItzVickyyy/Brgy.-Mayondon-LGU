// The Reports CSV export is always English, whatever the interface language is
// (owner decision, Nov 8). Needs the running app, like the other page specs.
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

const expectedHeader: Record<string, string> = {
  issuances: '"Document type","Issued","Voided","Share","vs previous period"',
  purpose: '"Purpose","Issued","Share"',
  expiry: '"Resident","Record","Reference","Expires","Status"',
  accounts:
    '"User","Role","Documents issued","Records added / edited","Last activity"',
}

// Position of each report in the "Report type" list.
const reportOrder = ["issuances", "purpose", "expiry", "imports", "accounts"]

const previewLabel = { en: "Preview Report", fil: "I-preview ang Ulat" }
const exportLabel = { en: "Export", fil: "I-export" }

for (const language of ["en", "fil"] as const) {
  for (const report of Object.keys(expectedHeader)) {
    test(`CSV for "${report}" is English when the interface is ${language}`, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem("app-language", value)
      }, language)
      await page.goto("/reports")
      await chooseOption(
        page.locator('[aria-haspopup="listbox"]').first(),
        reportOrder.indexOf(report),
      )
      await page
        .getByRole("button", { name: previewLabel[language], exact: true })
        .click()
      // Wait for the preview to load before exporting.
      await expect(page.getByText(/·/).first()).toBeVisible()

      const downloadPromise = page.waitForEvent("download")
      await page
        .getByRole("button", { name: exportLabel[language], exact: true })
        .click()
      const download = await downloadPromise
      const path = await download.path()
      const csv = readFileSync(path, "utf8")
      const lines = csv.split("\r\n")

      expect(lines[0]).toBe(expectedHeader[report])
      // The last row is the total row; its label is English too.
      expect(lines[lines.length - 1].startsWith('"Total"')).toBe(true)
    })
  }
}
