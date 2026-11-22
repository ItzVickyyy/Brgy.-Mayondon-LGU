// The "add a second administrator" reminder in the bell (patch 218). The API is mocked
// (synthetic data); the backend's own count is tested in test_issuances_certificates.py.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const staff = { ...admin, role: "staff", is_superuser: false }

async function mockApi(page: Page, user: object, admins: number) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(user)
    if (path.endsWith("/system/data-protection")) {
      return (user as { role: string }).role === "admin"
        ? json({
            key_configured: true,
            plain_count: 0,
            unreadable_count: 0,
            active_admin_count: admins,
          })
        : json({ detail: "Forbidden" }, 403)
    }
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

async function openBell(page: Page) {
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
}

test("one administrator: the bell asks for a second one", async ({ page }) => {
  await mockApi(page, admin, 1)
  await openBell(page)
  await expect(page.getByTestId("second-admin-reminder")).toContainText(
    "Only one administrator account",
  )
})

test("two administrators: no reminder", async ({ page }) => {
  await mockApi(page, admin, 2)
  await openBell(page)
  await expect(page.getByTestId("second-admin-reminder")).toHaveCount(0)
})

test("staff never see it", async ({ page }) => {
  await mockApi(page, staff, 1)
  await openBell(page)
  await expect(page.getByTestId("second-admin-reminder")).toHaveCount(0)
})
