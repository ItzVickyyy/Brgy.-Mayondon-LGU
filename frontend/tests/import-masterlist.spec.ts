// Import Masterlist tab against the real backend (System Administrator).
// Fictional names only. A random suffix keeps repeated runs from matching
// residents created by an earlier run.
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

test("upload, map, check and import a small fictional masterlist", async ({
  page,
}) => {
  const tag = Math.random().toString(36).slice(2, 8)
  const csv = [
    "Given Name,Surname,Birthday,Gender",
    `Alma${tag},Testerio,1990-02-03,Female`,
    `Bruno${tag},Testerio,1985-07-21,Male`,
    `Alma${tag},Testerio,1990-02-03,Female`,
    `Carla${tag},Testerio,not a date,Female`,
  ].join("\n")

  await page.goto("/records")
  await page.getByRole("tab", { name: "Import Masterlist" }).click()
  await expect(
    page.getByRole("heading", { name: "Import Existing Masterlist" }),
  ).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: `masterlist-${tag}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  })
  await page.getByRole("button", { name: "Upload and continue" }).click()

  // Step 2: the column names are recognised, so the mapping is pre-filled.
  await expect(
    page.getByRole("heading", { name: "Map spreadsheet columns" }),
  ).toBeVisible()
  const checkFile = page.getByRole("button", { name: "Check the file" })
  await expect(page.getByLabel(/^First name/)).toContainText("Given Name")
  await expect(page.getByLabel(/^Last name/)).toContainText("Surname")
  await expect(checkFile).toBeEnabled()

  // A required field with no column blocks the check until it is mapped again.
  await chooseOption(page.getByLabel(/^First name/), "Choose source column")
  await expect(checkFile).toBeDisabled()
  await expect(page.getByText("Choose a column for: First name")).toBeVisible()
  await chooseOption(page.getByLabel(/^First name/), "Given Name")
  await expect(checkFile).toBeEnabled()
  await checkFile.click()

  // Step 3: two new rows, one duplicate inside the file, one row with a problem.
  const counts = page.locator("div.rounded-xl.border", {
    hasText: "Has problems",
  })
  await expect(counts.first()).toBeVisible()
  await expect(page.getByRole("row", { name: /Duplicate/ })).toHaveCount(1)
  await expect(page.getByText("Repeated in this file")).toBeVisible()
  await expect(page.getByText("birthdate: Date not recognised")).toBeVisible()
  await page.getByRole("button", { name: "Problems", exact: true }).click()
  await expect(page.getByRole("row", { name: /Carla/ })).toHaveCount(0)

  await page.getByRole("button", { name: "Import", exact: true }).click()
  await page.getByRole("button", { name: "Import", exact: true }).last().click()

  // Step 4: results, then the history lists the file.
  await expect(
    page.getByText(`The import of masterlist-${tag}.csv is finished.`),
  ).toBeVisible()
  await expect(page.getByText("Created", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("row", { name: new RegExp(`masterlist-${tag}.csv`) }),
  ).toContainText("Completed")

  // The new residents are in Records.
  await page.getByRole("tab", { name: "Residents" }).click()
  await page
    .getByPlaceholder(/search/i)
    .first()
    .fill(`Alma${tag}`)
  await expect(page.getByText(`Alma${tag} Testerio`).first()).toBeVisible()

  // Reports lists the import, counts it, and exports an English CSV.
  await page.goto("/reports")
  await chooseOption(
    page.getByLabel(/^Report type/),
    "Masterlist import summary",
  )
  await page
    .getByRole("button", { name: "Preview Report", exact: true })
    .click()
  const reportRow = page.getByRole("row", {
    name: new RegExp(`masterlist-${tag}.csv`),
  })
  await expect(reportRow).toContainText("Completed")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const exported = readFileSync(await (await downloadPromise).path(), "utf8")
  expect(exported.split("\r\n")[0]).toBe(
    '"Date","File","By","Status","Created","Updated","Skipped","Failed"',
  )
  expect(exported).toContain(`masterlist-${tag}.csv`)
})
