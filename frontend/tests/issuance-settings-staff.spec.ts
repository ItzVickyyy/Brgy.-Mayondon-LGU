// Staff get the same Issuance settings as administrators: every tab, and the
// same wording. The API is mocked, so this spec needs only the running frontend.
import { expect, test } from "@playwright/test"

const staff = {
  id: "22222222-0000-0000-0000-000000000002",
  email: "staff@example.com",
  is_active: true,
  is_superuser: false,
  role: "staff",
  full_name: "Test Staff",
}

test("staff see every Issuance settings tab", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(staff)
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
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/issuances")
  await page.getByRole("button", { name: "Issuance settings" }).click()

  const dialog = page.getByTestId("issuance-settings")
  await expect(dialog.getByRole("tab")).toHaveCount(9)
  await dialog.getByTestId("settings-tab-street").click()
  await expect(dialog.getByTestId("settings-tab-street")).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(dialog.getByTestId("street-count")).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: /^Add/ }).first(),
  ).toBeVisible()
})
