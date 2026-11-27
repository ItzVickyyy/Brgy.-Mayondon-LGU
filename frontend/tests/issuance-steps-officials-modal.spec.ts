// Patch 297. (1) New Issuance: a numbered block must not turn into a check while the form is still empty (no person chosen,
// nothing typed): only step 1 (the document type that was picked) is complete. (2) Add Official: every position is shown
// at once as a choice inside the pop-up (the old drop-down was cut off by the pop-up's edge). Mocked API, needs only the frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

async function open(page: Page, path: string, width = 1280, height = 640) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me/preferences")) return json(null)
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/") || url.includes("/officials")) return json([])
    if (url.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width, height })
  await page.goto(path)
}

test("an empty New Issuance form shows no checked step except the document type, for every document", async ({
  page,
}) => {
  await open(page, "/issuances", 1280, 900)
  await page
    .getByRole("button", { name: /New Issuance/ })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  await expect(page.getByTestId("autosave-status")).toBeVisible()
  for (const name of [
    "Barangay Clearance",
    "Franchise Clearance",
    "Electrical & Water",
    "Residency",
    "Indigency",
    "Assistance Certification",
    "First-Time Jobseeker",
    "Barangay ID",
  ]) {
    await dialog.getByText(name, { exact: true }).first().click()
    const headings = dialog.locator("section[id^='issuance-step-'] h3")
    await expect(headings.first()).toContainText("(complete)")
    const count = await headings.count()
    for (let index = 1; index < count; index++) {
      await expect(
        headings.nth(index),
        `${name}, block ${index + 1}`,
      ).not.toContainText("(complete)")
    }
  }
})

test("Add Official picks the position from a dropdown and the choice is kept", async ({
  page,
}) => {
  await open(page, "/officials")
  await page
    .getByRole("button", { name: /Add Official/ })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  const trigger = dialog.getByTestId("official-position")
  await expect(trigger).toBeVisible()
  await expect(trigger).toContainText("Punong Barangay")
  await trigger.click()
  const options = page.getByRole("option")
  await expect(options).toHaveCount(8)
  await options.filter({ hasText: "Barangay Treasurer" }).click()
  await expect(trigger).toContainText("Barangay Treasurer")
  await expect(dialog.getByText("Appointed position.")).toBeVisible()
})
