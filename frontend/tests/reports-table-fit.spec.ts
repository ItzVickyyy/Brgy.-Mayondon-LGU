// Patch 322 (and 329, Deaths): the seven Management Reports tables must fit the box without a sideways scroll from 1024 px up
// (below that they scroll inside their own box, as before; the same tables are printed, so no cards)
// (long e-mail, long file name, long names; English and Filipino). Mocked API.
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

const period = {
  period: "quarter",
  start: "2026-10-01",
  end: "2026-11-26",
  previous_start: "2026-07-01",
  previous_end: "2026-09-30",
}

const longEmail =
  "maria.clara.delos.santos.reyes.administrator@barangay-mayondon.example"
const longName = "Maria Clara Delos Santos-Villanueva Ramirez y Fernandez"
const longFile =
  "masterlist-of-all-residents-purok-1-to-7-final-version-2026-corrected.xlsx"

const reports: Record<string, unknown> = {
  "/reports/issuances-by-type": {
    period,
    data: [
      "clearance",
      "residency",
      "indigency",
      "business_clearance",
      "assistance",
    ].map((code, i) => ({
      document_type_id: i + 1,
      code,
      name: "Certificate of Good Moral Character and Residency",
      issued: 1234 + i,
      voided: 12,
      corrections: 3,
      share_percent: 20.5,
      previous_issued: 1000,
      change_percent: -12.5,
    })),
    total_issued: 6170,
    total_voided: 60,
    total_corrections: 15,
  },
  "/reports/issuances-by-purpose": {
    period,
    data: [
      {
        purpose_id: 1,
        purpose: "Employment, scholarship and travel abroad requirements",
        issued: 120,
        share_percent: 60,
      },
      { purpose_id: null, purpose: "", issued: 80, share_percent: 40 },
    ],
    total_issued: 200,
  },
  "/reports/utilization": {
    period,
    data: [
      {
        month: "2026-10",
        month_start: "2026-10-01",
        month_end: "2026-10-31",
        clients_served: 1212,
        documents_issued: 1515,
      },
    ],
    total_clients: 1212,
    total_documents: 1515,
  },
  "/reports/deaths": {
    period,
    total: 1234,
    verified: 1000,
    reported: 234,
    by_sex: { male: 600, female: 600, not_recorded: 34 },
    by_age: [
      { bracket: "0-17", count: 12 },
      { bracket: "18-29", count: 34 },
      { bracket: "30-49", count: 56 },
      { bracket: "50-64", count: 78 },
      { bracket: "65+", count: 900 },
      { bracket: "unknown", count: 154 },
    ],
    by_purok: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((purok) => ({
      purok,
      count: 100,
    })),
    purok_not_recorded: 34,
    date_unknown: 12,
    date_too_general: 34,
  },
  "/reports/expiring": {
    data: [
      {
        kind: "barangay_id",
        issuance_id: "33333333-0000-0000-0000-000000000001",
        reference_no: "BRGY-ID-2026-0000123456",
        resident_id: "44444444-0000-0000-0000-000000000001",
        resident_name: longName,
        expires_on: "2026-12-01",
        days_left: -4,
        status: "expired",
      },
      {
        kind: "clearance",
        issuance_id: "33333333-0000-0000-0000-000000000002",
        reference_no: "CLR-2026-0000987654",
        resident_id: "44444444-0000-0000-0000-000000000002",
        resident_name: "Juan Dela Cruz",
        expires_on: "2026-12-20",
        days_left: 23,
        status: "expiring_soon",
      },
    ],
    count: 2,
  },
  "/reports/account-activity": {
    period,
    data: [
      {
        user_id: "55555555-0000-0000-0000-000000000001",
        email: longEmail,
        full_name: longName,
        role: "admin",
        is_active: true,
        documents_issued: 1234,
        records_changed: 4321,
        last_activity: "2026-11-26T08:30:00Z",
      },
      {
        user_id: "55555555-0000-0000-0000-000000000002",
        email: longEmail,
        full_name: null,
        role: "staff",
        is_active: true,
        documents_issued: 3,
        records_changed: 4,
        last_activity: null,
      },
    ],
  },
  "/imports/": {
    data: [
      {
        id: "66666666-0000-0000-0000-000000000001",
        file_name: longFile,
        created_by_email: longEmail,
        status: "committed",
        created_at: "2026-11-20T08:30:00Z",
        result: { created: 1200, updated: 300, skipped: 40, failed: 2 },
      },
    ],
    count: 1,
  },
}

async function open(page: Page, language: "en" | "fil", width: number) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    const path = url.pathname.replace("/api/v1", "")
    if (path.startsWith("/users/me/preferences")) return json(null)
    if (path.startsWith("/users/me")) return json(admin)
    if (path.startsWith("/reports/summary"))
      return json({
        period,
        documents_issued: 0,
        records_expiring: 0,
        imports_committed: 0,
      })
    if (reports[path]) return json(reports[path])
    if (path.startsWith("/lookups/")) return json([])
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((value) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", value)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
  await page.setViewportSize({ width, height: 900 })
  await page.goto("/reports")
}

const types = [
  "issuances",
  "purpose",
  "expiry",
  "imports",
  "accounts",
  "utilization",
  "deaths",
] as const

for (const language of ["en", "fil"] as const) {
  for (const width of [1920, 1440, 1280, 1152, 1024]) {
    for (const [index, type] of types.entries()) {
      test(`Reports ${type} table fits at ${width} px (${language})`, async ({
        page,
      }) => {
        await open(page, language, width)
        await chooseOption(
          page.locator('[aria-haspopup="listbox"]').first(),
          index,
        )
        const table = page.locator("table").first()
        await expect(table).toBeVisible()
        await expect(table.locator("tbody tr").first()).toBeVisible()
        const box = table.locator(
          "xpath=ancestor::div[contains(@class,'overflow-x-auto')][1]",
        )
        const m = await box.evaluate((el) => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
          page: document.documentElement.scrollWidth,
          view: document.documentElement.clientWidth,
        }))
        expect(
          m.scroll,
          `${type} ${language} ${width}: box scrolls`,
        ).toBeLessThanOrEqual(m.client)
        expect(m.page).toBeLessThanOrEqual(m.view)
      })
    }
  }
}
