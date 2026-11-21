// Dashboard: the issuance bars have their own soft colors, the three stat
// labels above them are plain muted text, and the population cards react to
// the pointer (hovering a ring segment lights its legend entry and back).
// The API is mocked, so this spec needs only the running frontend (--no-deps).
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
    { month: "2026-09", count: 7 },
    { month: "2026-10", count: 4 },
    { month: "2026-11", count: 3 },
  ],
  by_document_type: [],
  total_issued: 14,
  expiring: [],
  population: {
    total_population: 12480,
    total_households: 3612,
    total_voters: 8927,
    population_growth_percent: 2.1,
    household_growth_percent: 1.4,
    voter_growth_percent: null,
    male: 6103,
    female: 6377,
    age_brackets: [
      { bracket: "0-17", count: 2230 },
      { bracket: "18-29", count: 3120 },
      { bracket: "30-49", count: 3210 },
      { bracket: "50-64", count: 2180 },
      { bracket: "65+", count: 740 },
    ],
    by_purok: [1, 2, 3, 4, 5].map((purok, index) => ({
      purok,
      count: [1820, 1740, 1560, 1320, 1280][index],
    })),
    civil_status: [
      { status: "Single", count: 5766 },
      { status: "Married", count: 5492 },
      { status: "Widow/Widower", count: 761 },
      { status: "Legally Separated", count: 437 },
    ],
    sectoral: {
      pwd: 432,
      senior_citizens: 1248,
      children: 2496,
      solo_parents: 624,
    },
  },
}

test.beforeEach(async ({ page }) => {
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
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await expect(page.getByText("12,480").first()).toBeVisible()
  await page.waitForTimeout(1000) // number cards count up, bars rise
})

test("issuance bars use several soft colors and the stat labels are muted", async ({
  page,
}) => {
  const card = page.locator("article", {
    has: page.getByText("Document Issuances Over Time", { exact: true }),
  })
  const fills = await card
    .locator(".bar-rise")
    .evaluateAll((bars) =>
      bars.map((bar) => getComputedStyle(bar).backgroundColor),
    )
  expect(fills).toHaveLength(3)
  expect(new Set(fills).size).toBe(3)

  for (const label of ["Total issued", "Monthly average", "Busiest month"]) {
    const color = await card
      .getByText(label, { exact: true })
      .evaluate((node) => getComputedStyle(node).color)
    const stat = await page.evaluate(() => {
      const probe = document.createElement("span")
      probe.className = "text-muted-foreground"
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    })
    expect(color, label).toBe(stat)
  }
})

test("hovering the ring and its legend highlight each other (Gender)", async ({
  page,
}) => {
  const card = page.locator("article", {
    has: page.getByText("Gender Breakdown", { exact: true }),
  })
  const male = card.locator("li", { hasText: /^Male/ })
  const female = card.locator("li", { hasText: /^Female/ })
  await expect(male).not.toHaveClass(/bg-muted/)

  // Legend -> ring: Male lights up, Female fades, the ring centre shows 6,103.
  await male.hover()
  await expect(male).toHaveClass(/bg-muted/)
  await expect(female).toHaveClass(/opacity-40/)
  await expect(
    card.locator('circle[stroke="currentColor"]').first(),
  ).toHaveAttribute("stroke-width", "18")
  await expect(card.getByText("6,103")).toBeVisible()

  // Pointer away: everything is back to normal.
  await page.mouse.move(5, 5)
  await expect(female).not.toHaveClass(/opacity-40/)
  await expect(card.getByText("12,480")).toBeVisible()

  // Ring -> legend: the blue arc is the right-hand side of the ring.
  const ring = (await card.locator("svg.size-full").boundingBox())!
  const scale = ring.width / 120
  await page.mouse.move(
    ring.x + ring.width / 2 + 44 * scale,
    ring.y + ring.height / 2,
  )
  await expect(male).toHaveClass(/bg-muted/)
  await expect(female).toHaveClass(/opacity-40/)
})

test("age bars, purok rows and sector tiles fade their neighbours", async ({
  page,
}) => {
  const age = page.locator("article", {
    has: page.getByText("Age Brackets", { exact: true }),
  })
  const bars = age.locator("ul").first().locator("li")
  await bars.nth(1).hover()
  await expect(bars.nth(0)).toHaveClass(/opacity-40/)
  await expect(bars.nth(1)).not.toHaveClass(/opacity-40/)

  const purok = page.locator("article", {
    has: page.getByText("Population per Purok / Sitio", { exact: true }),
  })
  const rows = purok.locator("div.-mx-2")
  await rows.nth(2).hover()
  await expect(rows.nth(2)).toHaveClass(/bg-muted/)
  await expect(rows.nth(0)).toHaveClass(/opacity-40/)

  const sector = page.locator("article", {
    has: page.getByText("Sectoral Indicators", { exact: true }),
  })
  const tiles = sector.locator("div.rounded-lg.border")
  await tiles.nth(0).hover()
  await expect(tiles.nth(1)).toHaveClass(/opacity-40/)
  await expect(tiles.nth(0)).not.toHaveClass(/opacity-40/)
})
