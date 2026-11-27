// Patch 323: a Barangay IDs row opens the resident's profile when double-clicked,
// and the row menu has "View", like Records and Archived. The API is mocked
// (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const residentId = "7d6b7b8d-33b2-4766-8998-1cc14b85b5c1"
const resident = {
  id: residentId,
  first_name: "Maria1",
  last_name: "Santos1",
  middle_name: null,
  suffix: null,
  full_name: "Santos1, Maria1",
  birthdate: "1990-05-12",
  birth_place: "Nagcarlan, Laguna",
  sex: "Female",
  civil_status: "Single",
  occupation: "Teacher",
  house_number: "1",
  street_id: null,
  purok: 1,
  resident_since_year: 2000,
  resident_since_birth: false,
  residency_type: "new",
  voter_registration: "unregistered",
  sector_ids: [],
  has_photo: false,
  id_status: "valid",
  id_valid_until: "2027-05-12",
  id_validity_months: 6,
  status: "active",
  created_at: "2026-11-20T01:38:19.905795Z",
  updated_at: "2026-11-20T01:38:19.905806Z",
}

const barangayIds = {
  data: [
    {
      issuance_id: "00000000-0000-0000-0000-000000000001",
      reference_no: "ISS-2026-000001",
      resident_id: residentId,
      resident_name: "Santos1, Maria1",
      resident_status: "active",
      id_number: "BMY-001",
      transaction_type: "new",
      issue_date: "2026-05-12",
      valid_until: "2027-05-12",
      status: "valid",
    },
  ],
  count: 1,
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(admin)
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (path.includes("/barangay-ids/series/status"))
      return json({ configured: false })
    if (path.includes("/barangay-ids/series")) return json({})
    if (path.includes("/barangay-ids/")) return json(barangayIds)
    if (path.endsWith(`/residents/${residentId}`)) return json(resident)
    if (path.includes("/residents/")) return json({ data: [], count: 0 })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test("double-clicking a Barangay ID row opens the resident profile", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/records")
  await page.getByRole("tab").nth(3).click()
  const row = page.getByRole("row", { name: /Santos1, Maria1/ })
  await expect(row).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await row.dblclick()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("Santos1")
})
