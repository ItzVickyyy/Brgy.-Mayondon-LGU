// Ticking a row must not move the table on Records, Archived, Deceased, Barangay IDs,
// Officials and Backup History either (320; 318 and 319 did the other three).
// Measured on `master` before the fix: 4 px at every desktop width and 56 px at
// 390 px on the first four, 24 to 112 px on Backup. The API is mocked
// (synthetic data), so this spec needs only the running frontend.
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

const residents = (status: string) => ({
  data: [1, 2, 3].map((n) => ({
    id: `7d6b7b8d-33b2-4766-8998-1cc14b85b5c${n}`,
    first_name: `Maria${n}`,
    last_name: `Santos${n}`,
    middle_name: null,
    suffix: null,
    full_name: `Santos${n}, Maria${n}`,
    birthdate: "1990-05-12",
    sex: "Female",
    civil_status: "Single",
    occupation: "Teacher",
    house_number: `${n}`,
    street_id: null,
    purok: 2,
    id_number: `BMY-00${n}`,
    id_status: "valid",
    id_valid_until: "2027-05-12",
    age: 36,
    sector_ids: [],
    has_photo: false,
    status,
    archive_reason: status === "archived" ? "Moved away" : null,
    archived_at: status === "archived" ? "2026-11-01T01:00:00Z" : null,
    archived_by_name: status === "archived" ? "Test Admin" : null,
    death:
      status === "deceased"
        ? {
            date_of_death: "2026-03-14",
            date_precision: "day",
            evidence: "verified",
            source_note: null,
            age_at_death: 35,
            recorded_at: "2026-03-20T01:00:00Z",
            recorded_by_name: "Test Admin",
          }
        : null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  })),
  count: 3,
})

const barangayIds = {
  data: [1, 2, 3].map((n) => ({
    issuance_id: `00000000-0000-0000-0000-00000000000${n}`,
    reference_no: `ISS-2026-00000${n}`,
    resident_id: `7d6b7b8d-33b2-4766-8998-1cc14b85b5c${n}`,
    resident_name: `Santos${n}, Maria${n}`,
    resident_status: "active",
    id_number: `BMY-00${n}`,
    transaction_type: "new",
    issue_date: "2026-05-12",
    valid_until: "2027-05-12",
    status: "valid",
  })),
  count: 3,
}

const officials = [1, 2, 3].map((n) => ({
  id: `44444444-0000-0000-0000-00000000000${n}`,
  full_name: `Official ${n}`,
  position: "Barangay Kagawad",
  term_start: "2023-11-01",
  term_end: null,
  is_elected: true,
  is_current: true,
}))

const backups = {
  data: [1, 2, 3].map((n) => ({
    id: `55555555-0000-0000-0000-00000000000${n}`,
    started_at: `2026-11-2${n}T09:00:00Z`,
    finished_at: `2026-11-2${n}T09:01:00Z`,
    kind: "manual",
    status: "ok",
    file_name: `backup-${n}.enc`,
    size_bytes: 1048576,
    sha256: "abc",
    verified_at: null,
    created_by_email: "admin@example.com",
    error: null,
    file_exists: true,
  })),
  count: 3,
  tool_available: true,
  keep_copies: 14,
}

async function mockApi(page: Page, language: string) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith("/users/me")) return json(admin)
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (path.includes("/barangay-ids/series/status"))
      return json({ configured: false })
    if (path.includes("/barangay-ids/series")) return json({})
    if (path.includes("/barangay-ids/")) return json(barangayIds)
    if (path.includes("/officials/")) return json(officials)
    if (path.includes("/backups/")) return json(backups)
    if (path.includes("/residents/"))
      return json(residents(url.searchParams.get("status") ?? "active"))
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

const tables = [
  { name: "Records", path: "/records", tab: 0 },
  { name: "Archived", path: "/records", tab: 1 },
  { name: "Deceased", path: "/records", tab: 2 },
  { name: "Barangay IDs", path: "/records", tab: 3 },
  { name: "Officials", path: "/officials", tab: null },
  { name: "Backup History", path: "/backup-restore", tab: null },
]

for (const { name, path, tab } of tables) {
  for (const language of ["en", "fil"]) {
    for (const width of [1920, 1440, 1280, 1024, 860, 768, 640, 390]) {
      test(`${name}: ticking a row does not move the rows at ${width} px (${language})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 })
        await mockApi(page, language)
        await page.goto(path)
        if (tab !== null) {
          await page.getByRole("tab").nth(tab).click()
        }
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
