// Backup history: when every recorded backup has lost its file, the page says so plainly.
// The API is mocked (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const run = (n: number, fileExists: boolean) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  started_at: "2026-11-20T01:38:44.962818Z",
  finished_at: "2026-11-20T01:38:45.962818Z",
  kind: "manual",
  status: "ok",
  file_name: `mayondon-db-20261120-093844-00${n}.dump`,
  size_bytes: 2048,
  verified_at: "2026-11-20T01:38:45.962818Z",
  created_by_email: "admin@example.com",
  error: null,
  file_exists: fileExists,
})

async function mockApi(page: Page, runs: ReturnType<typeof run>[]) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/backups/"))
      return json({
        data: runs,
        count: runs.length,
        tool_available: true,
        keep_copies: 14,
      })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test("a warning shows when no recorded backup has its file", async ({
  page,
}) => {
  await mockApi(page, [run(1, false), run(2, false)])
  await page.goto("/backup-restore")
  await expect(page.getByTestId("backup-files-missing")).toBeVisible()
})

test("no warning while at least one backup file is there", async ({ page }) => {
  await mockApi(page, [run(1, false), run(2, true)])
  await page.goto("/backup-restore")
  await expect(
    page.getByText("mayondon-db-20261120-093844-002.dump").first(),
  ).toBeVisible()
  await expect(page.getByTestId("backup-files-missing")).toHaveCount(0)
})
