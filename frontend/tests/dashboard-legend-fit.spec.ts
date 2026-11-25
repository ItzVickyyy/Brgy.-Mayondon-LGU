// Dashboard: the legends of the Gender and Civil Status rings stay inside their cards at every
// width. The ring and its legend sit side by side only when the card is wide enough (container
// query), otherwise the legend goes under the ring. Measured on the text itself, because the
// legend's box stays narrow while its text spills out of the card. The API is mocked, so this
// spec needs only the running frontend (--no-deps).
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
    by_purok: [{ purok: 1, count: 1820 }],
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
      teens: 800,
      adults: 4000,
      urban_poor: 150,
      indigenous_people: 60,
    },
  },
}

const cards = {
  en: ["Gender Breakdown", "Civil Status Distribution"],
  fil: ["Hati ayon sa Kasarian", "Distribusyon ng Katayuang Sibil"],
}

for (const language of ["en", "fil"] as const) {
  for (const width of [390, 768, 1024, 1280, 1366, 1440, 1536, 1920]) {
    test(`ring legends stay inside their cards (${language}, ${width}px)`, async ({
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
      await expect(page.getByText("12,480").first()).toBeVisible()
      await page.waitForTimeout(1000) // number cards count up for 600 ms

      for (const title of cards[language]) {
        const card = page.locator("article", {
          has: page.getByText(title, { exact: true }),
        })
        await expect(card, title).toBeVisible()
        const over = await card.evaluate((article) => {
          const edge = article.getBoundingClientRect().right
          let worst = 0
          const walker = document.createTreeWalker(
            article,
            NodeFilter.SHOW_TEXT,
          )
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim()) continue
            const parent = node.parentElement
            if (!parent || parent.closest(".sr-only")) continue
            const range = document.createRange()
            range.selectNodeContents(node)
            for (const rect of Array.from(range.getClientRects())) {
              if (rect.width > 0) worst = Math.max(worst, rect.right - edge)
            }
          }
          return worst
        })
        expect(
          over,
          `${title} text runs past the card edge`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
}
