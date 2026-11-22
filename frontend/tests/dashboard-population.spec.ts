// Dashboard: the population cards sit under "Document Issuances Over Time" and
// "Issuances by Document Type", in the layout of the owner's reference picture.
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
      teens: 800,
      adults: 4000,
      urban_poor: 150,
      indigenous_people: 60,
    },
  },
}

const titles = {
  en: {
    overTime: "Document Issuances Over Time",
    byType: "Issuances by Document Type",
    cards: [
      "Total Population",
      "Total Registered Households",
      "Total Registered Voters",
      "Gender Breakdown",
      "Age Brackets",
      "Population per Purok / Sitio",
      "Civil Status Distribution",
      "Sectoral Indicators",
    ],
  },
  fil: {
    overTime: "Mga Naisyung Dokumento sa Paglipas ng Panahon",
    byType: "Mga Naisyu ayon sa Uri ng Dokumento",
    cards: [
      "Kabuuang Populasyon",
      "Kabuuang Rehistradong Sambahayan",
      "Kabuuang Rehistradong Botante",
      "Hati ayon sa Kasarian",
      "Mga Pangkat ng Edad",
      "Populasyon bawat Purok / Sitio",
      "Distribusyon ng Katayuang Sibil",
      "Mga Tagapagpahiwatig ng Sektor",
    ],
  },
}

for (const language of ["en", "fil"] as const) {
  for (const width of [1280, 390]) {
    test(`population cards follow the reference layout (${language}, ${width}px)`, async ({
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

      const text = titles[language]
      const boxes = []
      for (const title of text.cards) {
        const card = page.locator("article", {
          has: page.getByText(title, { exact: true }),
        })
        await expect(card, title).toBeVisible()
        boxes.push((await card.boundingBox())!)
      }
      const [pop, house, voters, gender, age, purok, civil, sector] = boxes

      // Under both of the cards that were already there.
      const typeCard = page.locator("article", {
        has: page.getByText(text.byType, { exact: true }),
      })
      const overTime = page.locator("article", {
        has: page.getByText(text.overTime, { exact: true }),
      })
      const chartsBottom = Math.max(
        (await typeCard.boundingBox())!.y +
          (await typeCard.boundingBox())!.height,
        (await overTime.boundingBox())!.y +
          (await overTime.boundingBox())!.height,
      )
      for (const box of boxes)
        expect(box.y).toBeGreaterThanOrEqual(chartsBottom - 1)

      // The figures come from the API.
      await expect(page.getByText("3,612").first()).toBeVisible()
      await expect(page.getByText("8,927").first()).toBeVisible()
      await expect(page.getByText("3,210").first()).toBeVisible()
      await expect(page.getByText("1,820").first()).toBeVisible()
      await expect(page.getByText("2,496").first()).toBeVisible()

      if (width >= 1280) {
        // Row 1: three number cards, gender, age, left to right on one line.
        for (const box of [house, voters, gender, age])
          expect(Math.abs(box.y - pop.y)).toBeLessThan(2)
        expect(pop.x).toBeLessThan(house.x)
        expect(house.x).toBeLessThan(voters.x)
        expect(voters.x).toBeLessThan(gender.x)
        expect(gender.x).toBeLessThan(age.x)
        // Row 2: purok, civil status, sectoral indicators.
        expect(purok.y).toBeGreaterThan(pop.y + pop.height - 1)
        for (const box of [civil, sector])
          expect(Math.abs(box.y - purok.y)).toBeLessThan(2)
        expect(purok.x).toBeLessThan(civil.x)
        expect(civil.x).toBeLessThan(sector.x)
        // The sector card is the widest of row 2.
        expect(sector.width).toBeGreaterThan(civil.width)
      }

      // Nothing makes the page scroll sideways.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
}
