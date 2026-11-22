// Export opens a pop-up that asks for the file type; each choice saves a real file of that type.
// Needs the running app, like the other Reports specs.
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

test("Export asks for the file type and has no Preview Report button", async ({
  page,
}) => {
  await page.goto("/reports")
  await expect(page.getByText(/·/).first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Preview Report" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Export", exact: true }).click()
  for (const format of ["xlsx", "docx", "pdf", "csv"]) {
    await expect(page.getByTestId(`export-format-${format}`)).toBeVisible()
  }
  await page.getByTestId("export-cancel").click()
  await expect(page.getByTestId("export-format-pdf")).toHaveCount(0)
})

const signatures = {
  xlsx: { ext: ".xlsx", starts: "PK" },
  docx: { ext: ".docx", starts: "PK" },
  pdf: { ext: ".pdf", starts: "%PDF-" },
  csv: { ext: ".csv", starts: '"Document type"' },
} as const

for (const [format, expected] of Object.entries(signatures)) {
  test(`choosing ${format} saves a ${expected.ext} file`, async ({ page }) => {
    await page.goto("/reports")
    await expect(page.getByText(/·/).first()).toBeVisible()
    await page.getByRole("button", { name: "Export", exact: true }).click()
    const downloadPromise = page.waitForEvent("download")
    await page.getByTestId(`export-format-${format}`).click()
    const download = await downloadPromise
    expect(download.suggestedFilename().endsWith(expected.ext)).toBe(true)
    const bytes = readFileSync(await download.path())
    expect(bytes.subarray(0, expected.starts.length).toString("latin1")).toBe(
      expected.starts,
    )
  })
}
