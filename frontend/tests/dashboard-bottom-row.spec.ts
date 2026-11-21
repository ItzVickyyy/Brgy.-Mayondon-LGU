// Dashboard: the three number cards have their icon and title on the left (the
// numbers stay centred), and
// "Expiring IDs and Clearances" and "Recent Activities" share one row (stacked
// on narrow screens). The API is mocked, so only the running frontend is needed.
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
    clearances_expiring: 1,
    barangay_ids_expiring: 0,
    clearance_window_days: 30,
    id_window_days: 30,
    open_drafts: 0,
  },
  issuances_over_time: [{ month: "2026-11", count: 3 }],
  by_document_type: [],
  total_issued: 3,
  expiring: [
    {
      issuance_id: "11111111-0000-0000-0000-000000000001",
      resident_name: "Grace Flores Alcantara",
      kind: "clearance",
      reference_no: "ISS-2026-000032",
      expires_on: "2026-12-01",
      days_left: 10,
    },
  ],
  population: {
    total_population: 12480,
    total_households: 3612,
    total_voters: 8927,
    population_growth_percent: 2.1,
    household_growth_percent: 1.4,
    voter_growth_percent: null,
    male: 6103,
    female: 6377,
    age_brackets: [],
    by_purok: [],
    civil_status: [],
    sectoral: { pwd: 0, senior_citizens: 0, children: 0, solo_parents: 0 },
  },
}

const activity = {
  data: [
    {
      id: 1,
      action: "issuance.issue",
      module: "issuances",
      details: { reference_no: "ISS-2026-000032" },
      occurred_at: "2026-11-21T01:00:00Z",
      actor_email: "admin@example.com",
      is_own: true,
    },
  ],
  count: 1,
}

const titles = {
  en: {
    expiring: "Expiring IDs and Clearances",
    recent: "Recent Activities",
    population: "Total Population",
  },
  fil: {
    expiring: "Mga ID at Clearance na Mag-e-expire",
    recent: "Mga Kamakailang Aktibidad",
    population: "Kabuuang Populasyon",
  },
}

for (const language of ["en", "fil"] as const) {
  for (const width of [1280, 390]) {
    test(`number cards are left aligned and the two lists share a row (${language}, ${width}px)`, async ({
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
        if (url.includes("/activity")) return json(activity)
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
      await expect(page.getByText("12,480").first()).toBeVisible()
      await page.waitForTimeout(1000)

      const text = titles[language]
      const card = (title: string) =>
        page.locator("article", {
          has: page.getByText(title, { exact: true }),
        })

      // The icon and title start at the left edge of the card, while the
      // number stays in the middle of it.
      const pop = card(text.population)
      const popBox = (await pop.boundingBox())!
      const iconBox = (await pop.locator("svg").first().boundingBox())!
      expect(iconBox.x - popBox.x).toBeLessThan(24)
      const numberBox = (await pop.getByText("12,480").first().boundingBox())!
      const numberMiddle = numberBox.x + numberBox.width / 2
      expect(
        Math.abs(numberMiddle - (popBox.x + popBox.width / 2)),
      ).toBeLessThan(8)

      // One row on wide screens, stacked on phones.
      const expiring = card(text.expiring)
      const recent = card(text.recent)
      await expect(expiring.getByText("Grace Flores Alcantara")).toBeVisible()
      await expect(recent).toBeVisible()
      const a = (await expiring.boundingBox())!
      const b = (await recent.boundingBox())!
      if (width >= 1280) {
        expect(Math.abs(a.y - b.y)).toBeLessThan(2)
        expect(a.x).toBeLessThan(b.x)
        expect(Math.abs(a.height - b.height)).toBeLessThan(2)
      } else {
        expect(b.y).toBeGreaterThan(a.y + a.height - 1)
      }

      // The Expiring card has an icon like the Recent Activities card.
      await expect(expiring.locator("svg").first()).toBeVisible()

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
}
