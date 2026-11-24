// Filling in the birthdate of a name-only record (as left by the Barangay ID
// history import) warns when the same person is already on record; changing
// only the address does not warn. Needs the running app.
import { expect, test } from "@playwright/test"

test("editing a name-only record: address saves quietly, a matching birthdate warns", async ({
  page,
}) => {
  await page.goto("/records")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const tag = `Stub${Date.now() % 1000000}`
  const person = {
    first_name: "Rosa",
    middle_name: "Reyes",
    last_name: tag,
    sex: "Female",
    civil_status: "Single",
  }
  const full = await page.request.post("/api/v1/residents/", {
    headers,
    data: { ...person, birthdate: "1985-02-03" },
  })
  expect(full.status()).toBe(201)
  // The name-only record is the same person; saying so on purpose is allowed.
  const stub = await page.request.post(
    "/api/v1/residents/?confirm_duplicate=true",
    { headers, data: { ...person, birthdate: null } },
  )
  expect(stub.status()).toBe(201)

  await page
    .getByPlaceholder(/search/i)
    .first()
    .fill(tag)
  await expect(page.getByRole("row", { name: new RegExp(tag) })).toHaveCount(2)
  const stubRow = page
    .getByRole("row", { name: new RegExp(tag) })
    .filter({ hasNotText: "1985" })
  await stubRow.getByRole("button", { name: "Profile", exact: true }).click()
  await page.getByRole("button", { name: "Edit details", exact: true }).click()

  // Only the house number changes: no warning, it saves.
  await page.getByLabel(/House/i).first().fill("12")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText(/ updated$/)).toBeVisible()
  await expect(page.getByTestId("duplicate-matches")).toHaveCount(0)

  // Filling in the birthdate of the person who is already on record warns.
  await page.getByRole("button", { name: "Edit details", exact: true }).click()
  await page.locator('input[type="date"]').first().fill("1985-02-03")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  const matches = page.getByTestId("duplicate-matches")
  await expect(matches).toBeVisible()
  await expect(matches).toContainText(tag)
  await expect(matches).toContainText("born 1985-02-03")
  await page.getByRole("button", { name: "Save anyway" }).click()
  await expect(page.getByText(/ updated$/).first()).toBeVisible()
})
