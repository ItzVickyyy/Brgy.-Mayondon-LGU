// The "health conditions are not protected" reminder in the bell (patch 214). The API is mocked
// (synthetic data): the backend's own counts are tested in test_issuances_certificates.py.
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

type Protection = {
  key_configured: boolean
  plain_count: number
  unreadable_count: number
}

async function mockApi(page: Page, user: object, protection: Protection) {
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
      // Staff are refused by the real server.
      return (user as { role: string }).role === "admin"
        ? json(protection)
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

test("a missing key shows an orange reminder with the steps", async ({
  page,
}) => {
  await mockApi(page, admin, {
    key_configured: false,
    plain_count: 2,
    unreadable_count: 0,
  })
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  const reminder = page.getByTestId("data-key-reminder")
  await expect(reminder).toBeVisible()
  await expect(reminder).toHaveAttribute("data-severity", "soon")
  await expect(reminder).toContainText("saved without protection")
  await reminder.getByRole("button", { name: "What to do" }).click()
  const dialog = page.getByTestId("data-key-dialog")
  await expect(dialog).toContainText("ensure-data-key.ps1")
  await expect(dialog).toContainText("docker compose -f compose.yml up -d")
  await expect(dialog).toContainText("USB drive")
  await page.getByTestId("data-key-close").click()
  await expect(dialog).toHaveCount(0)
})

test("values that cannot be opened show a red reminder and warn against a new key", async ({
  page,
}) => {
  await mockApi(page, admin, {
    key_configured: true,
    plain_count: 0,
    unreadable_count: 3,
  })
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  const reminder = page.getByTestId("data-key-reminder")
  await expect(reminder).toHaveAttribute("data-severity", "urgent")
  await expect(reminder).toContainText("3 saved health conditions")
  await reminder.getByRole("button", { name: "What to do" }).click()
  const dialog = page.getByTestId("data-key-dialog")
  await expect(dialog).toContainText("do not make a new key")
  await expect(dialog).toContainText("DATA_ENCRYPTION_KEY")
})

test("one unreadable value reads in the singular", async ({ page }) => {
  await mockApi(page, admin, {
    key_configured: true,
    plain_count: 0,
    unreadable_count: 1,
  })
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("data-key-reminder")).toContainText(
    "1 saved health condition cannot",
  )
})

test("a key that works shows nothing", async ({ page }) => {
  await mockApi(page, admin, {
    key_configured: true,
    plain_count: 0,
    unreadable_count: 0,
  })
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("data-key-reminder")).toHaveCount(0)
})

test("staff never see it", async ({ page }) => {
  await mockApi(page, staff, {
    key_configured: false,
    plain_count: 1,
    unreadable_count: 0,
  })
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("data-key-reminder")).toHaveCount(0)
})

test("the Filipino text is shown in Filipino", async ({ page }) => {
  await mockApi(page, admin, {
    key_configured: false,
    plain_count: 1,
    unreadable_count: 0,
  })
  await page.addInitScript(() => localStorage.setItem("app-language", "fil"))
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("data-key-reminder")).toContainText(
    "Walang proteksyon",
  )
})
