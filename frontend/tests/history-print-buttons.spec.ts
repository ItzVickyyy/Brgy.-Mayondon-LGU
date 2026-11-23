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
    "Correct & edit",
    "Archive",
    "Void issuance",
  ])
})

test("every issued row has an Export button that opens a Word / PDF popup", async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/issuances")
  const row = page.locator("table tbody tr").first()
  await row.getByRole("button", { name: /^Export for Resident/ }).click()
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
