// Dashboard: with the Period set to "This Week" the issuance chart shows one
// bar per day, Sunday to Saturday (the API sends the seven days).
// The API is mocked, so this spec needs only the running frontend (--no-deps).
import { expect, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

// 2026-11-22 is a Sunday; 2026-11-28 is the Saturday after it.
const week = [
  "2026-11-22",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-11-28",
].map((day, index) => ({ day, count: [0, 3, 5, 2, 0, 0, 0][index] }))

const dashboard = (period: string) => ({
  period: { period, start: null, end: "2026-11-24" },
  summary: {
    documents_issued_this_month: 3,
    clearances_expiring: 0,
    barangay_ids_expiring: 0,
    clearance_window_days: 30,
    id_window_days: 30,
    open_drafts: 0,
  },
  issuances_over_time: [{ month: "2026-11", count: 10 }],
  issuances_by_day: period === "week" ? week : [],
  by_document_type: [],
  total_issued: 10,
  expiring: [],
})

for (const language of ["en", "fil"] as const) {
  test(`This Week shows Sunday to Saturday (${language})`, async ({ page }) => {
    await page.route("**/api/v1/**", async (route) => {
      const json = (body: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        })
      const url = new URL(route.request().url())
      if (url.pathname.includes("/users/me")) return json(admin)
      if (url.pathname.includes("/lookups/")) return json([])
      if (url.pathname.includes("/dashboard"))
        return json(dashboard(url.searchParams.get("period") ?? "overall"))
      return json({ data: [], count: 0 })
    })
    await page.addInitScript((lang) => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", lang)
      localStorage.setItem("vite-ui-theme", "light")
    }, language)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")

    const trigger = page.locator("#dashboard-period")
    await chooseOption(trigger, 1) // list order: Today, This Week, ...

    // Seven bars, one per day, with the weekday under each (table is for
    // screen readers and lists the same days in order).
    const rows = page.locator("table tbody tr")
    await expect(rows).toHaveCount(7)
    const labels = await rows.locator("th").allTextContents()
    expect(labels).toHaveLength(7)
    const weekdays = labels.map((label) => label.split(",")[0].trim())
    expect(new Set(weekdays).size).toBe(7)
    // First is the Sunday (22 Nov), last the Saturday (28 Nov).
    expect(labels[0]).toMatch(/22/)
    expect(labels[6]).toMatch(/28/)
    await expect(page.locator(".bar-rise")).toHaveCount(7)
  })
}
