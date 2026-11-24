// The Add Resident form refuses letters in number boxes and digits in name
// boxes, shows a message for a bad phone number and keeps N as the shortcut for
// the add button. The API is mocked, so this spec needs only the running app.
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
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
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1280, height: 900 })
})

test("N opens Add Resident and the boxes filter what is typed", async ({
  page,
}) => {
  await page.goto("/records")
  await expect(
    page.getByRole("button", { name: "Add Resident", exact: false }).first(),
  ).toBeVisible()
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("n")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  const first = dialog.locator("#resident-form-first-name")
  await first.pressSequentially("Ma. Niña 123 <b>")
  await expect(first).toHaveValue("Ma. Niña b")

  const purok = dialog.getByLabel("Purok")
  await purok.pressSequentially("1e+5x")
  await expect(purok).toHaveValue("15")
  await purok.fill("")
  await purok.pressSequentially("0")
  await expect(dialog.getByText(/number from 1 to 99/)).toBeVisible()

  const since = dialog.getByLabel(/Resident since/i).first()
  await since.pressSequentially("20ab245")
  await expect(since).toHaveValue("2024")

  const phone = dialog.getByLabel(/Contact number|Phone/i).last()
  await phone.pressSequentially("09ab17-123 4567+")
  await expect(phone).toHaveValue("0917-123 4567")
  await phone.fill("")
  await phone.pressSequentially("123")
  await expect(dialog.getByText(/7 to 13 digits/)).toBeVisible()
  await page.screenshot({ path: "test-results/input-validation.png" })
})
