// The "network is not protected" reminder in the bell (patch 212). The API is mocked (synthetic
// data). The test server runs at http://localhost, which is exempt on purpose, so the page's
// address is played with a request to 127.0.0.2 (an address of this computer, not "localhost").
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

async function mockApi(page: Page, user: object) {
  await page.route("**/api/v1/**", async (route) => {
    // The page is on another host than the API address baked into the build: allow it.
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    }
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors })
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(user)
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

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8000"
const otherHost = BASE.replace("localhost", "127.0.0.2")

test("an administrator on a network address over http sees the reminder", async ({
  page,
}) => {
  await mockApi(page, admin)
  await page.goto(`${otherHost}/`)
  await page.getByTestId("notification-bell").click()
  const reminder = page.getByTestId("plain-http-reminder")
  await expect(reminder).toBeVisible()
  await expect(reminder).toContainText("This network is not protected")
  await reminder.getByRole("button", { name: "What to do" }).click()
  const dialog = page.getByTestId("plain-http-dialog")
  await expect(dialog).toContainText("can read passwords")
  await page.getByTestId("plain-http-close").click()
  await expect(dialog).toHaveCount(0)
})

test("Remind me later hides it", async ({ page }) => {
  await mockApi(page, admin)
  await page.goto(`${otherHost}/`)
  await page.getByTestId("notification-bell").click()
  await page
    .getByTestId("plain-http-reminder")
    .getByRole("button", { name: "What to do" })
    .click()
  await page.getByTestId("plain-http-snooze").click()
  await expect(page.getByTestId("plain-http-dialog")).toHaveCount(0)
  await page.reload()
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("plain-http-reminder")).toHaveCount(0)
})

test("localhost (the server computer) shows nothing", async ({ page }) => {
  await mockApi(page, admin)
  await page.goto(`${BASE}/`)
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("plain-http-reminder")).toHaveCount(0)
})

test("staff never see it", async ({ page }) => {
  await mockApi(page, staff)
  await page.goto(`${otherHost}/`)
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("plain-http-reminder")).toHaveCount(0)
})
