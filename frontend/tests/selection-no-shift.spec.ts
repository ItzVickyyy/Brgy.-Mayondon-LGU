// Ticking a row must not move the table, at any width (318, 319). Below 1400 px the
// selection tools sit on their own line in the filter panel; that line is kept
// (with a hint) while nothing is ticked. The API is mocked (synthetic data), so
// this spec needs only the running frontend.
import { expect, type Locator, type Page, test } from "@playwright/test"
import { waitUntilSettled } from "./utils/settled"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const documentTypes = [
  {
    id: 1,
    code: "BARANGAY_CLEARANCE",
    name: "BARANGAY_CLEARANCE",
    category: "clearance",
    print_mode: "overlay",
    validity_months: 2,
    one_per_resident: false,
    signatory_default_position: null,
  },
]
const issuances = {
  data: [1, 2, 3].map((n) => ({
    id: `00000000-0000-0000-0000-00000000000${n}`,
    reference_no: `ISS-2026-00000${n}`,
    status: "issued",
    document_type_id: 1,
    document_type_code: "BARANGAY_CLEARANCE",
    resident_id: "7d6b7b8d-33b2-4766-8998-1cc14b85b5cf",
    resident_name: `Resident ${n}`,
    issue_date: "2026-11-20",
    purpose_id: null,
    expires_on: "2027-01-20",
    issued_at: "2026-11-20T01:38:44.987923Z",
    corrects_issuance_id: null,
    created_at: "2026-11-20T01:38:44.962818Z",
    archived_at: null,
    archived_by_name: null,
    archive_reason: null,
    original_status: null,
  })),
  count: 3,
}
const activity = {
  data: [1, 2, 3].map((n) => ({
    id: n,
    occurred_at: "2026-11-20T01:38:44.987923Z",
    actor_user_id: `33333333-0000-0000-0000-00000000000${n}`,
    actor_email: `person${n}@example.test`,
    is_own: false,
    action: "resident.update",
    module: "records",
    record_type: "resident",
    record_id: `rec-${n}`,
    outcome: "success",
    reason: null,
    details: null,
  })),
  count: 3,
}

const users = {
  count: 3,
  data: [1, 2, 3].map((n) => ({
    id: `22222222-0000-0000-0000-00000000010${n}`,
    email: `person${n}@example.test`,
    full_name: `Person ${n}`,
    is_active: true,
    is_superuser: false,
    role: "staff",
    must_change_password: false,
    locked_until: null,
  })),
}

async function mockApi(page: Page, language: string) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/users/me")) return json(admin)
    if (url.pathname.includes("/users/")) return json(users)
    if (url.pathname.endsWith("/activity/options"))
      return json({ modules: [], actions: [], outcomes: [], actors: [] })
    if (url.pathname.endsWith("/activity/")) return json(activity)
    if (url.pathname.includes("/lookups/document-types"))
      return json(documentTypes)
    if (url.pathname.includes("/lookups/")) return json([])
    if (url.pathname.includes("/dashboard"))
      return json({ total_issued: 3, by_document_type: [] })
    if (url.pathname.includes("/issuances/")) return json(issuances)
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((lang) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", lang)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
}

// Position on the page, not in the window: a click may scroll a card into view.
const pageTop = (locator: Locator) =>
  locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)

const pages = [
  { name: "Issuance History", path: "/issuances" },
  { name: "Activity Log", path: "/activity-log" },
  { name: "User Accounts", path: "/admin" },
]

for (const { name, path } of pages) {
  for (const language of ["en", "fil"]) {
    for (const width of [1440, 1399, 1280, 1024, 390]) {
      test(`${name}: ticking a row does not move the rows at ${width} px (${language})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 })
        await mockApi(page, language)
        await page.goto(path)
        const first = page.getByTestId("row-select").first()
        await expect(first).toBeVisible()
        await expect(page.getByTestId("selection-bar")).toHaveCount(0)
        await waitUntilSettled(first)
        const before = await pageTop(first)
        await first.click()
        await expect(page.getByTestId("selection-bar")).toHaveCount(1)
        await waitUntilSettled(first)
        const after = await pageTop(first)
        expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
        // Clearing returns to the same place.
        await page.getByRole("button", { name: /^(Clear|Alisin)/ }).click()
        await expect(page.getByTestId("selection-bar")).toHaveCount(0)
        await waitUntilSettled(first)
        const back = await pageTop(first)
        expect(Math.abs(back - before)).toBeLessThanOrEqual(1)
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true)
      })
    }
  }
}
