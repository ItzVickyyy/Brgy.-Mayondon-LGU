// Patch 302: Management Reports has a "Utilization report" type (clients served and documents issued per
// month, like the monthly Certificate of Utilization). Mocked API, needs only the frontend.
import { expect, type Page, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const report = {
  period: {
    period: "quarter",
    start: "2026-10-01",
    end: "2026-11-26",
    previous_start: "2026-07-01",
    previous_end: "2026-09-30",
  },
  data: [
    {
      month: "2026-10",
      month_start: "2026-10-01",
      month_end: "2026-10-31",
      clients_served: 12,
      documents_issued: 15,
    },
    {
      month: "2026-11",
      month_start: "2026-11-01",
      month_end: "2026-11-26",
      clients_served: 9,
      documents_issued: 11,
    },
  ],
  total_clients: 18,
  total_documents: 26,
}

async function open(page: Page, language: "en" | "fil") {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me/preferences")) return json(null)
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/reports/utilization")) return json(report)
    if (url.includes("/reports/summary"))
      return json({
        period: report.period,
        documents_issued: 0,
        records_expiring: 0,
        imports_committed: 0,
      })
    if (url.includes("/lookups/")) return json([])
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((value) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", value)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/reports")
}

for (const language of ["en", "fil"] as const) {
  test(`the Utilization report lists each month and one total (${language})`, async ({
    page,
  }) => {
    await open(page, language)
    await chooseOption(page.locator('[aria-haspopup="listbox"]').first(), 5)
    const rows = page.locator("tbody tr")
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText("12")
    await expect(rows.nth(0)).toContainText("15")
    await expect(rows.nth(1)).toContainText("9")
    await expect(rows.nth(1)).toContainText("11")
    // The total counts each resident once, so it is not the sum of the months (12 + 9).
    const total = page.locator("tfoot tr")
    await expect(total).toContainText("18")
    await expect(total).toContainText("26")
    await expect(total).not.toContainText("21")
  })
}
