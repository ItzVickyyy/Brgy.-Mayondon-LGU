// Main content: tighter page margin, and the content does not move sideways
// when a page becomes long enough to scroll, or when the Dashboard Period
// changes. The API is mocked, so this spec needs only the running frontend
// (run with --no-deps).
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const dashboard = {
  period: { period: "overall", start: null, end: "2026-11-21" },
  summary: {
    documents_issued_this_month: 3,
    clearances_expiring: 0,
    barangay_ids_expiring: 0,
    clearance_window_days: 30,
    id_window_days: 30,
    open_drafts: 0,
  },
  issuances_over_time: [{ month: "2026-11", count: 3 }],
  by_document_type: [],
  total_issued: 3,
  expiring: [],
}

test("content keeps its left edge and the Period change does not reload the page", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/")) return json([])
    if (url.includes("/dashboard/")) {
      // Slow answer, so a loading state would be visible if it existed.
      await new Promise((resolve) => setTimeout(resolve, 600))
      return json(dashboard)
    }
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByText("Total issued")).toBeVisible()

  const content = page.locator("main > div.page-enter")
  const box = await content.boundingBox()
  expect(box).not.toBeNull()
  // Tighter margin: at 1920 px the content is wider than the old 1280 px cap.
  expect(box?.width ?? 0).toBeGreaterThan(1400)

  // The page scrollbar's space is always reserved.
  const gutter = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarGutter,
  )
  expect(gutter).toContain("stable")

  // Changing the Period keeps the old figures on screen (no skeleton swap) and
  // does not move or resize the page.
  const before = await content.boundingBox()
  await page.locator("#dashboard-period").click()
  await page.getByRole("option", { name: "This Month" }).click()
  await page.waitForTimeout(150)
  await expect(page.getByText("Total issued")).toBeVisible()
  const during = await content.boundingBox()
  expect(during?.x).toBe(before?.x)
  // Within 1 px: the height can differ by a sub-pixel fraction (1755 vs 1755.00003).
  const drift = Math.abs((during?.height ?? 0) - (before?.height ?? 0))
  expect(drift).toBeLessThan(1)
  await page.waitForTimeout(900)
  const after = await content.boundingBox()
  expect(after?.x).toBe(before?.x)
})
