// Issuance History: every issued row has a Print button in the Actions column when its document type has a
// print template (all of them except Barangay ID); a type without one shows the button disabled with a reason.
// The API is mocked (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const codes = [
  "BARANGAY_CLEARANCE",
  "FRANCHISE_CLEARANCE",
  "UTILITY_CLEARANCE",
  "INDIGENCY",
  "ASSISTANCE",
  "RESIDENCY",
  "FIRST_TIME_JOBSEEKER",
  "BARANGAY_ID",
]
const documentTypes = codes.map((code, index) => ({
  id: index + 1,
  code,
  name: code,
  category: "clearance",
  print_mode: "overlay",
  validity_months: 2,
  one_per_resident: false,
  signatory_default_position: null,
}))
const issuances = {
  data: codes.map((code, index) => ({
    id: `00000000-0000-0000-0000-00000000000${index + 1}`,
    reference_no: `ISS-2026-00000${index + 1}`,
    status: "issued",
    document_type_id: index + 1,
    document_type_code: code,
    resident_id: "7d6b7b8d-33b2-4766-8998-1cc14b85b5cf",
    resident_name: `Resident ${index + 1}`,
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
  count: codes.length,
}

async function mockApi(page: Page) {
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
      return json({ total_issued: 8, by_document_type: [] })
    if (url.includes("/issuances/")) return json(issuances)
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test("every issued row has Print; Barangay ID shows it disabled", async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")

  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(codes.length)
  for (let index = 0; index < codes.length; index++) {
    const print = rows
      .nth(index)
      .getByRole("button", { name: /^Print for Resident/ })
    await expect(print).toBeVisible()
    if (codes[index] === "BARANGAY_ID") await expect(print).toBeDisabled()
    else await expect(print).toBeEnabled()
  }
})

test("the three-dot menu keeps the agreed order", async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const row = page.locator("table tbody tr").first()
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: /more|actions|iba pa/i }).click()
  const labels = await page.getByRole("menuitem").allInnerTexts()
  expect(labels.map((l) => l.trim())).toEqual([
    "Export",
    "Archive",
    "Void issuance",
  ])
})

test("Export is in the three-dot menu and opens a Word / PDF popup", async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const row = page.locator("table tbody tr").first()
  await row.getByRole("button", { name: /more|actions|iba pa/i }).click()
  await page.getByRole("menuitem", { name: "Export" }).click()
  await expect(page.getByTestId("issuance-export-docx")).toBeVisible()
  await expect(page.getByTestId("issuance-export-pdf")).toBeVisible()
  await page.getByTestId("issuance-export-cancel").click()
  await expect(page.getByTestId("issuance-export-docx")).toBeHidden()
})

test("Print is one button that asks Data only or Form and data", async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const row = page.locator("table tbody tr").first()
  await expect(
    row.getByRole("button", { name: /^Choose how to print/ }),
  ).toHaveCount(0)
  await row.getByRole("button", { name: /^Print for Resident/ }).click()
  await expect(page.getByTestId("print-mode-data")).toBeVisible()
  await expect(page.getByTestId("print-mode-form")).toBeVisible()
  await page.getByTestId("print-mode-cancel").click()
  await expect(page.getByTestId("print-mode-data")).toBeHidden()
})

test("a short list shows no page controls", async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  await expect(page.locator("table tbody tr").first()).toBeVisible()
  await expect(page.getByText("Rows per page")).toHaveCount(0)
  await expect(
    page.getByRole("navigation", { name: "Pagination" }),
  ).toHaveCount(0)
})

test("an issued row reads View, Edit, Print, then the three-dot menu", async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const row = page.locator("table tbody tr").first()
  await expect(row).toBeVisible()
  const labels = await row
    .locator("td")
    .last()
    .getByRole("button")
    .allInnerTexts()
  expect(labels.map((l) => l.trim()).slice(0, 3)).toEqual([
    "View",
    "Edit",
    "Print",
  ])
})

test("Edit and Print stay in place on every row; they are disabled when they do not apply", async ({
  page,
}) => {
  await mockApi(page)
  const base = issuances.data[3]
  const rowsFor = [
    { ...base, id: "00000000-0000-0000-0000-0000000000a1", status: "issued" },
    {
      ...base,
      id: "00000000-0000-0000-0000-0000000000a2",
      status: "voided",
      resident_name: "Resident Voided",
    },
    {
      ...base,
      id: "00000000-0000-0000-0000-0000000000a3",
      status: "draft",
      reference_no: null,
      resident_name: "Resident Draft",
    },
  ]
  await page.route("**/api/v1/issuances/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: rowsFor, count: rowsFor.length }),
    }),
  )
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(3)

  const xs: number[][] = []
  for (let index = 0; index < 3; index++) {
    const buttons = rows.nth(index).locator("td").last().getByRole("button")
    await expect(buttons).toHaveCount(4)
    const boxes = await Promise.all(
      [0, 1, 2, 3].map((n) => buttons.nth(n).boundingBox()),
    )
    xs.push(boxes.map((box) => Math.round(box?.x ?? -1)))
  }
  expect(xs[1]).toEqual(xs[0])
  expect(xs[2]).toEqual(xs[0])

  // Voided: View stays usable, Edit and Print are there but disabled.
  const voided = rows.nth(1).locator("td").last().getByRole("button")
  await expect(voided.nth(0)).toBeEnabled()
  await expect(voided.nth(1)).toBeDisabled()
  await expect(voided.nth(2)).toBeDisabled()
  // Draft: Edit (continue draft) works, Print is disabled.
  const draft = rows.nth(2).locator("td").last().getByRole("button")
  await expect(draft.nth(1)).toBeEnabled()
  await expect(draft.nth(2)).toBeDisabled()
})

test("a disabled Print button explains itself on hover", async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(codes.length)

  // Barangay ID has no print template: its Print button is disabled and says why.
  const idRow = rows.nth(codes.indexOf("BARANGAY_ID"))
  await idRow.getByTestId("disabled-reason-trigger").hover()
  const tip = page.locator('[data-slot="tooltip-content"]')
  await expect(tip.first()).toContainText("No print template")
  // No permanent note is drawn under the buttons any more.
  await expect(page.getByTestId("row-actions-note")).toHaveCount(0)

  // An enabled Print button has no wrapper and shows no reason.
  const okRow = rows.first()
  await expect(okRow.getByTestId("disabled-reason-trigger")).toHaveCount(0)
})
