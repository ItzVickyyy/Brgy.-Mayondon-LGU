// The report preview is always on screen: it loads with the page and follows the
// two selects, with no need to press "Preview Report". Needs the running app.
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

const expectedHeader: Record<string, string> = {
  issuances: '"Document type","Issued","Voided","Share","vs previous period"',
  purpose: '"Purpose","Issued","Share"',
  expiry: '"Resident","Record","Reference","Expires","Status"',
  imports: '"Date","File","By","Status","Created","Updated","Skipped","Failed"',
  accounts:
    '"User","Role","Documents issued","Records added / edited","Last activity"',
}

// Position of each report in the "Report type" list.
const reportOrder = ["issuances", "purpose", "expiry", "imports", "accounts"]

async function csvHeader(page: import("@playwright/test").Page) {
  // Short timeout: until the report has loaded, Export shows a notice instead.
  const downloadPromise = page
    .waitForEvent("download", { timeout: 2000 })
    .catch(() => null)
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const download = await downloadPromise
  if (!download) return ""
  return readFileSync(await download.path(), "utf8").split("\r\n")[0]
}

test("the report is shown on load without pressing Preview Report", async ({
  page,
}) => {
  await page.goto("/reports")
  await expect(page.getByText("Report preview area")).toHaveCount(0)
  // The exported header only exists once the report has loaded by itself.
  await expect(page.getByText(/·/).first()).toBeVisible()
  await expect.poll(() => csvHeader(page)).toBe(expectedHeader.issuances)
})

for (const report of reportOrder) {
  test(`choosing "${report}" shows it without pressing Preview Report`, async ({
    page,
  }) => {
    await page.goto("/reports")
    await chooseOption(
      page.locator('[aria-haspopup="listbox"]').first(),
      reportOrder.indexOf(report),
    )
    await expect(page.getByText("Report preview area")).toHaveCount(0)
    await expect.poll(async () => csvHeader(page)).toBe(expectedHeader[report])
  })
}
