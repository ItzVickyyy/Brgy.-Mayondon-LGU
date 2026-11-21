// Dashboard: number-card labels are small and muted, section titles share one
// semibold style, every stat number is bold with tight spacing, and the
// Gender ring sits in the middle of its card when there is room.
// The API is mocked, so this spec needs only the running frontend
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
  period: { period: "year", start: null, end: "2026-11-21" },
  summary: {
    documents_issued_this_month: 1,
    clearances_expiring: 0,
    barangay_ids_expiring: 0,
    clearance_window_days: 30,
    id_window_days: 30,
    open_drafts: 0,
  },
  issuances_over_time: [
    { month: "2026-10", count: 6 },
    { month: "2026-11", count: 3 },
  ],
  by_document_type: [],
  total_issued: 9,
  expiring: [],
  population: {
    total_population: 21088,
    total_households: 1967,
    total_voters: 428,
    population_growth_percent: 2,
    household_growth_percent: 1,
    voter_growth_percent: 3,
    male: 10400,
    female: 10688,
    age_brackets: [
      { bracket: "0-4", count: 1448 },
      { bracket: "5-17", count: 4611 },
      { bracket: "18-35", count: 7464 },
    ],
    by_purok: [{ purok: 1, count: 4000 }],
    civil_status: [
      { status: "Single", count: 9000 },
      { status: "Married", count: 8000 },
      { status: "Widowed", count: 2000 },
      { status: "Separated", count: 1000 },
    ],
    sectoral: {
      pwd: 300,
      senior_citizens: 2100,
      children: 5000,
      solo_parents: 400,
    },
  },
}

// Number-card and population-card labels: small, medium-weight, muted (the
// "stat label" style).
const numberCardLabels = [
  "Documents Issued This Month",
  "Clearances Expiring in 30 Days",
  "Barangay IDs Expiring in 30 Days",
  "Pending Document Requests",
  "Total Population",
  "Total Registered Households",
  "Total Registered Voters",
  "Gender Breakdown",
  "Age Brackets",
  "Population per Purok / Sitio",
  "Civil Status Distribution",
  "Sectoral Indicators",
]

// Section cards (not the population cards): semibold, normal text color.
const titles = [
  "Quick Actions",
  "Document Issuances Over Time",
  "Issuances by Document Type",
  "Expiring IDs and Clearances",
  "Recent Activities",
]

for (const width of [1280, 1920]) {
  test(`card titles share one style and the Gender ring is centred (${width}px)`, async ({
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
      if (url.includes("/dashboard/")) return json(dashboard)
      return json({ data: [], count: 0 })
    })
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", "en")
      localStorage.setItem("vite-ui-theme", "light")
    })
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("/")
    await expect(page.getByText("Gender Breakdown")).toBeVisible()

    const styleOf = async (text: string) =>
      page
        .getByText(text, { exact: true })
        .first()
        .evaluate((node) => {
          const css = getComputedStyle(node)
          return [css.fontFamily, css.fontSize, css.fontWeight, css.color].join(
            "|",
          )
        })
    const heading = await Promise.all(titles.map(styleOf))
    expect(new Set(heading).size).toBe(1)
    const labels = await Promise.all(numberCardLabels.map(styleOf))
    expect(new Set(labels).size).toBe(1)
    // The two groups differ on purpose: labels are lighter and fainter.
    expect(labels[0]).not.toBe(heading[0])
    expect(labels[0]).toContain("|500|")

    // Every stat number shares one weight and one letter-spacing.
    const figures = await page.locator(".stat-figure").evaluateAll((nodes) =>
      nodes.map((node) => {
        const css = getComputedStyle(node)
        return [css.fontWeight, css.letterSpacing !== "normal"].join("|")
      }),
    )
    expect(figures.length).toBeGreaterThanOrEqual(8)
    expect(new Set(figures)).toEqual(new Set(["700|true"]))

    // The ring sits in the middle of the Gender card whenever the card is wide
    // enough to also hold the legend beside it (the card is ~370 px at 1920).
    if (width >= 1920) {
      const card = page.locator("article", {
        has: page.getByText("Gender Breakdown", { exact: true }),
      })
      const ring = card.locator('[role="img"]').first()
      const cardBox = await card.boundingBox()
      const ringBox = await ring.boundingBox()
      const cardMiddle = (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2
      const ringMiddle = (ringBox?.x ?? 0) + (ringBox?.width ?? 0) / 2
      expect(Math.abs(cardMiddle - ringMiddle)).toBeLessThan(2)
    }
  })
}
