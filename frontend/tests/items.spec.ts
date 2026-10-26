import { expect, test } from "@playwright/test"

test("Dashboard page is accessible", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByText("An overview of household, population, voter, and document records.")).toBeVisible()
})

test("Issuances Management page is accessible", async ({ page }) => {
  await page.goto("/issuances")
  await expect(page.getByRole("heading", { name: "Issuances Management" })).toBeVisible()
})

test("Records Management page displays sample resident records", async ({ page }) => {
  await page.goto("/records")
  await expect(page.getByRole("heading", { name: "Records Management" })).toBeVisible()
  await expect(page.getByText("Sample Resident One")).toBeVisible()

  const search = page.getByPlaceholder("Search records...")
  await search.fill("Sample Resident One")
  await expect(page.getByText("Sample Resident One")).toBeVisible()
  await expect(page.getByText("Sample Resident Two")).not.toBeVisible()
})

test("Records Management search filters results", async ({ page }) => {
  await page.goto("/records")
  await page.getByPlaceholder("Search records...").fill("no-record-matches-this")
  await expect(page.getByText("Sample Resident One")).not.toBeVisible()
})

test("Officials page displays sample officials", async ({ page }) => {
  await page.goto("/officials")
  await expect(page.getByRole("heading", { name: "Officials", exact: true })).toBeVisible()
  await expect(page.getByText("Sample Official One")).toBeVisible()
})

test("Officials search filters results", async ({ page }) => {
  await page.goto("/officials")
  await page.getByPlaceholder("Search officials...").fill("no-official-matches-this")
  await expect(page.getByText("No sample officials match your search.")).toBeVisible()
})
