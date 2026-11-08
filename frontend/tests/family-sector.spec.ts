// Family & Sector tab (sector part) against the real backend (System Administrator).
// Fictional names only; a random tag keeps repeated runs apart.
import { expect, test } from "@playwright/test"

test("sector counts and the residents in a sector", async ({ page }) => {
  const tag = Math.random().toString(36).slice(2, 8)
  await page.goto("/records")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  const headers = { Authorization: `Bearer ${token}` }

  const sectors = await (
    await page.request.get("/api/v1/lookups/sectors", { headers })
  ).json()
  expect(sectors.length).toBeGreaterThan(0)
  const sector = sectors[0]

  for (const given of ["Dina", "Edgar"]) {
    const created = await page.request.post("/api/v1/residents/", {
      headers,
      data: {
        first_name: `${given}${tag}`,
        last_name: "Sectorio",
        birthdate: "1991-04-05",
        sex: "Female",
        civil_status: "Single",
        sector_ids: [sector.id],
      },
    })
    expect(created.status()).toBe(201)
  }

  await page.reload()
  await page.getByRole("tab", { name: "Family & Sector" }).click()
  await expect(
    page.getByText("Choose a sector to see its active residents."),
  ).toBeVisible()
  await expect(page.getByText("Not available yet")).toHaveCount(2)

  const sectorButton = page.getByRole("button", {
    name: new RegExp(`^${sector.name}`),
  })
  await expect(sectorButton).toHaveAttribute("aria-pressed", "false")
  await sectorButton.click()
  await expect(sectorButton).toHaveAttribute("aria-pressed", "true")

  await expect(
    page.getByRole("heading", { name: `Active residents in ${sector.name}` }),
  ).toBeVisible()
  await page.getByRole("button", { name: `View profile: Dina${tag}` }).waitFor()

  // The profile opens on its Family & Sector tab and lists the sector.
  await page
    .getByRole("button", { name: new RegExp(`View profile: .*Dina${tag}`) })
    .click()
  await expect(page.getByRole("dialog")).toContainText(sector.name)
})
