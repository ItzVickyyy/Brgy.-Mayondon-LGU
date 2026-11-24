// Ctrl+K finds a resident from any page, and an unsaved new-resident form comes back as a
// draft (and goes away when discarded). The API is mocked, so this spec needs only the running app.
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const person = {
  id: "33333333-0000-0000-0000-000000000001",
  first_name: "Maria",
  last_name: "Santos",
  full_name: "SANTOS, Maria",
  birthdate: "1990-05-17",
  purok: 3,
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/")) return json([])
    if (url.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (url.includes("/residents/") && url.includes("q=Santos"))
      return json({ data: [person], count: 1 })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1280, height: 900 })
})

test("Ctrl+K lists matches and opens Records searching for the person", async ({
  page,
}) => {
  await page.goto("/")
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("Control+k")
  const box = page.getByTestId("quick-search-input")
  await expect(box).toBeFocused()
  await box.pressSequentially("Santos")
  const row = page.getByTestId("quick-search-row").first()
  await expect(row).toContainText("SANTOS, Maria")
  await expect(row).toContainText("Purok 3")
  await box.press("Enter")
  await expect(page).toHaveURL(/\/records\?q=SANTOS/)
  await expect(page.locator("#main-content input[value]").first()).toHaveValue(
    "SANTOS, Maria",
  )
})

test("an unsaved new resident comes back as a draft and can be discarded", async ({
  page,
}) => {
  await page.goto("/records")
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("n")
  const dialog = page.getByRole("dialog")
  await dialog.locator("#resident-form-first-name").fill("Juana")
  await dialog.locator("#resident-form-last-name").fill("Cruz")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  await page.reload()
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("n")
  await expect(page.getByTestId("resident-draft-notice")).toBeVisible()
  await expect(page.locator("#resident-form-first-name")).toHaveValue("Juana")

  await page.getByTestId("resident-draft-discard").click()
  await expect(page.getByTestId("resident-draft-notice")).toBeHidden()
  await expect(page.locator("#resident-form-first-name")).toHaveValue("")
  await page.keyboard.press("Escape")
  await page.reload()
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("n")
  await expect(page.getByTestId("resident-draft-notice")).toBeHidden()
})
