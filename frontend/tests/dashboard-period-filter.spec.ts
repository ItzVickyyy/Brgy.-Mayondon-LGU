// Dashboard: the Period filter sits in the upper right corner of the
// "Document Issuances Over Time" card, not in the page header. The API is
// mocked, so this spec needs only the running frontend (run with --no-deps).
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
  issuances_over_time: [
    { month: "2026-06", count: 2 },
    { month: "2026-07", count: 5 },
    { month: "2026-08", count: 3 },
    { month: "2026-09", count: 7 },
    { month: "2026-10", count: 4 },
    { month: "2026-11", count: 3 },
  ],
  by_document_type: [],
  total_issued: 24,
  expiring: [],
}

const titles = {
  en: "Document Issuances Over Time",
  fil: "Mga Naisyung Dokumento sa Paglipas ng Panahon",
}

for (const language of ["en", "fil"] as const) {
  for (const width of [1280, 390]) {
    test(`Period filter is in the chart card's upper right (${language}, ${width}px)`, async ({
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
        if (url.includes("/dashboard")) return json(dashboard)
        return json({ data: [], count: 0 })
      })
      await page.addInitScript((lang) => {
        localStorage.setItem("access_token", "test-token")
        localStorage.setItem("app-language", lang)
        localStorage.setItem("vite-ui-theme", "light")
      }, language)
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/")

      const card = page.locator("article", {
        has: page.getByText(titles[language], { exact: true }),
      })
      const period = card.locator("#dashboard-period")
      await expect(period).toBeVisible()

      // Only one period filter on the page, and it is the one in the card.
      await expect(page.locator("#dashboard-period")).toHaveCount(1)

      const cardBox = (await card.boundingBox())!
      const box = (await period.boundingBox())!
      // Upper part of the card; on a laptop also against its right edge.
      expect(box.y - cardBox.y).toBeLessThan(width >= 640 ? 40 : 140)
      if (width >= 640) {
        expect(cardBox.x + cardBox.width - (box.x + box.width)).toBeLessThan(40)
      }

      // The old year badge is gone and the page does not scroll sideways.
      await expect(card.getByText(/^2026$/)).toHaveCount(0)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
}
