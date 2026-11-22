// The "backup is old / missing" reminder in the bell (patch 219). The API is mocked (synthetic data).
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

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()
const run = (status: string, n: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  started_at: daysAgo(n),
  finished_at: daysAgo(n),
  kind: "scheduled",
  status,
  file_name: "x.dump",
  size_bytes: 1,
  sha256: null,
  verified_at: null,
  created_by_email: null,
  error: null,
  file_exists: true,
})

async function mockApi(page: Page, user: object, runs: object[], tool = true) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(user)
    if (path.endsWith("/backups/"))
      return json({
        data: runs,
        count: runs.length,
        tool_available: tool,
        keep_copies: 14,
      })
    if (path.endsWith("/system/data-protection"))
      return json({
        key_configured: true,
        plain_count: 0,
        unreadable_count: 0,
        active_admin_count: 2,
      })
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

const reminder = (page: Page) => page.getByTestId("backup-stale-reminder")

test("a fresh backup shows nothing", async ({ page }) => {
  await mockApi(page, admin, [run("ok", 1)])
  await openBell(page)
  await expect(reminder(page)).toHaveCount(0)
})

test("a 4-day-old backup is orange", async ({ page }) => {
  await mockApi(page, admin, [run("failed", 1), run("ok", 4)])
  await openBell(page)
  await expect(reminder(page)).toHaveAttribute("data-severity", "soon")
  await expect(reminder(page)).toContainText("4 days old")
})

test("an 8-day-old backup is red", async ({ page }) => {
  await mockApi(page, admin, [run("ok", 8)])
  await openBell(page)
  await expect(reminder(page)).toHaveAttribute("data-severity", "urgent")
})

test("no successful backup at all is red", async ({ page }) => {
  await mockApi(page, admin, [run("failed", 1)])
  await openBell(page)
  await expect(reminder(page)).toContainText("No backup has been made yet")
  await expect(reminder(page)).toHaveAttribute("data-severity", "urgent")
})

test("a missing tool is the other reminder's job", async ({ page }) => {
  await mockApi(page, admin, [], false)
  await openBell(page)
  await expect(reminder(page)).toHaveCount(0)
})

test("staff never see it", async ({ page }) => {
  await mockApi(page, staff, [])
  await openBell(page)
  await expect(reminder(page)).toHaveCount(0)
})
