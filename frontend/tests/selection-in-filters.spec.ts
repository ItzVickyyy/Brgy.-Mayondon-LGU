// Selection tools sit in the table's filter panel, at the right (290), and the
// two "from / to" dates are one joined field. The API is mocked (synthetic
// data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

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

async function mockApi(page: Page, language: string) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/document-types")) return json(documentTypes)
    if (url.includes("/lookups/")) return json([])
    if (url.includes("/dashboard"))
      return json({ total_issued: 3, by_document_type: [] })
    if (url.includes("/issuances/")) return json(issuances)
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((lang) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", lang)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
}

for (const language of ["en", "fil"]) {
  test(`Issuance History: tools appear at the right of the filters, dates are one field (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await mockApi(page, language)
    await page.goto("/issuances")
    await expect(page.locator("table tbody tr")).toHaveCount(3)

    // One joined date field: one legend, two date inputs in one box.
    const range = page.locator("fieldset", {
      has: page.locator('input[type="date"]'),
    })
    await expect(range).toHaveCount(1)
    await expect(range.locator("legend")).toHaveCount(1)
    await expect(range.locator('input[type="date"]')).toHaveCount(2)

    const panel = page
      .locator("div.bg-muted\\/30", { has: page.locator("fieldset") })
      .first()
    await expect(page.getByTestId("selection-bar")).toHaveCount(0)
    await page.getByTestId("row-select").nth(1).click()
    const bar = page.getByTestId("selection-bar")
    await expect(bar).toHaveCount(1)
    await expect(panel.getByTestId("selection-bar")).toHaveCount(1)

    const barBox = await bar.boundingBox()
    const panelBox = await panel.boundingBox()
    const tableBox = await page.locator("table").first().boundingBox()
    if (!barBox || !panelBox || !tableBox) throw new Error("no boxes")
    // Inside the filter panel, hugging its right edge, above the table.
    expect(barBox.y).toBeGreaterThanOrEqual(panelBox.y)
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(
      panelBox.y + panelBox.height + 1,
    )
    expect(
      panelBox.x + panelBox.width - (barBox.x + barBox.width),
    ).toBeLessThanOrEqual(24)
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(tableBox.y)
    // It does not overflow sideways.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("Issuance History at 390 px: tools stay inside the panel, no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await mockApi(page, "en")
  await page.goto("/issuances")
  await expect(page.getByTestId("row-select").first()).toBeVisible()
  await page.getByTestId("row-select").first().click()
  const bar = page.getByTestId("selection-bar")
  await expect(bar).toBeVisible()
  const box = await bar.boundingBox()
  if (!box) throw new Error("no box")
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
})

test("Activity Log: dates are one field and tools sit in the filter card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockApi(page, "en")
  await page.route("**/api/v1/activity/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        count: 0,
        modules: [],
        actors: [],
        outcomes: [],
      }),
    }),
  )
  await page.goto("/activity-log")
  const range = page.locator("fieldset", {
    has: page.locator('input[type="date"]'),
  })
  await expect(range).toHaveCount(1)
  await expect(range.locator('input[type="date"]')).toHaveCount(2)
})
