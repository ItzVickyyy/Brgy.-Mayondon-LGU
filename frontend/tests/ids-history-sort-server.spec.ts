// Barangay IDs and Issuance History: a heading click asks the server to sort
// the whole list (316), not just the rows on the page. The API is mocked
// (synthetic data), so this spec needs only the running frontend. The mock
// answers a sort in an odd order: the page must show the rows as received.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

// ES2020 has no Array.prototype.at.
const last = <T>(items: T[]) => items[items.length - 1]

const idRow = (n: number, first: string) => ({
  issuance_id: `00000000-0000-0000-0000-00000000000${n}`,
  reference_no: `ISS-2026-00000${n}`,
  resident_id: `11111111-0000-0000-0000-00000000000${n}`,
  resident_name: `${first} Sorttest`,
  resident_status: "active",
  id_number: `ID-${n}`,
  transaction_type: "new",
  issue_date: "2026-11-20",
  valid_until: "2027-11-20",
  status: "valid",
})

const issuanceRow = (n: number, first: string) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  reference_no: `ISS-2026-00000${n}`,
  status: "issued",
  document_type_id: 1,
  document_type_code: "BARANGAY_CLEARANCE",
  resident_id: `11111111-0000-0000-0000-00000000000${n}`,
  resident_name: `${first} Sorttest`,
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
})

const documentTypes = [
  {
    id: 1,
    code: "BARANGAY_CLEARANCE",
    name: "Barangay Clearance",
    category: "clearance",
    print_mode: "overlay",
    validity_months: 2,
    one_per_resident: false,
    signatory_default_position: null,
  },
]

// The two list calls only: the cards above the tables ask the same endpoint
// for one row to count, and those are not the list.
const listCalls = (queries: URLSearchParams[]) =>
  queries.filter((q) => q.get("limit") !== "1")

async function mockApi(
  page: Page,
  queries: { ids: URLSearchParams[]; history: URLSearchParams[] },
) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/users/me")) return json(admin)
    if (url.pathname.endsWith("/lookups/document-types"))
      return json(documentTypes)
    if (url.pathname.includes("/lookups/")) return json([])
    if (url.pathname.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (url.pathname.endsWith("/barangay-ids/series/status"))
      return json({ enabled: false, preview: null })
    if (url.pathname.endsWith("/barangay-ids/series"))
      return json({
        prefix: "",
        include_year: false,
        digit_width: 0,
        restart_yearly: false,
        next_number: 1,
        enabled: false,
        preview: "1",
        updated_at: "2026-11-20T01:38:19.905806Z",
        updated_by_name: null,
      })
    if (url.pathname.endsWith("/barangay-ids/")) {
      queries.ids.push(url.searchParams)
      const rows = [idRow(1, "Alpha"), idRow(2, "Bravo")]
      if (url.searchParams.has("sort_by")) rows.reverse()
      return json({ data: rows, count: rows.length })
    }
    if (url.pathname.endsWith("/issuances/")) {
      queries.history.push(url.searchParams)
      const rows = [issuanceRow(1, "Alpha"), issuanceRow(2, "Bravo")]
      if (url.searchParams.has("sort_by")) rows.reverse()
      return json({ data: rows, count: rows.length })
    }
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

const newQueries = () => ({
  ids: [] as URLSearchParams[],
  history: [] as URLSearchParams[],
})

test("Barangay IDs sorts on the server, cycling ascending, descending, default", async ({
  page,
}) => {
  const queries = newQueries()
  await page.setViewportSize({ width: 1700, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/records?view=barangay-ids")
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText("Alpha")
  expect(last(listCalls(queries.ids)).has("sort_by")).toBe(false)

  const heading = page.getByTestId("sort-resident")
  await heading.click()
  await expect(rows.first()).toContainText("Bravo")
  expect(last(listCalls(queries.ids)).get("sort_by")).toBe("resident")
  expect(last(listCalls(queries.ids)).get("sort_dir")).toBe("asc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "desc")
  await expect
    .poll(() => last(listCalls(queries.ids)).get("sort_dir"))
    .toBe("desc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "none")
  await expect(rows.first()).toContainText("Alpha")
  expect(last(listCalls(queries.ids)).has("sort_by")).toBe(false)
})

test("Each Barangay IDs heading asks for its own server column", async ({
  page,
}) => {
  const queries = newQueries()
  await page.setViewportSize({ width: 1700, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/records?view=barangay-ids")
  await expect(page.locator("table tbody tr")).toHaveCount(2)
  const columns = {
    resident: "resident",
    idNumber: "id_number",
    card: "card",
    issued: "issued",
    validUntil: "valid_until",
    status: "status",
  }
  for (const [heading, serverColumn] of Object.entries(columns)) {
    await page.getByTestId(`sort-${heading}`).click()
    await expect
      .poll(() => last(listCalls(queries.ids)).get("sort_by"))
      .toBe(serverColumn)
  }
})

test("Issuance History sorts on the server, cycling ascending, descending, default", async ({
  page,
}) => {
  const queries = newQueries()
  await page.setViewportSize({ width: 1700, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/issuances")
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText("Alpha")
  expect(last(listCalls(queries.history)).has("sort_by")).toBe(false)

  const heading = page.getByTestId("sort-resident")
  await heading.click()
  await expect(rows.first()).toContainText("Bravo")
  expect(last(listCalls(queries.history)).get("sort_by")).toBe("resident")
  expect(last(listCalls(queries.history)).get("sort_dir")).toBe("asc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "desc")
  await expect
    .poll(() => last(listCalls(queries.history)).get("sort_dir"))
    .toBe("desc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "none")
  await expect(rows.first()).toContainText("Alpha")
  expect(last(listCalls(queries.history)).has("sort_by")).toBe(false)
})

test("Each Issuance History heading asks for its own server column", async ({
  page,
}) => {
  const queries = newQueries()
  await page.setViewportSize({ width: 1700, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/issuances")
  await expect(page.locator("table tbody tr")).toHaveCount(2)
  const columns = {
    resident: "resident",
    document: "document",
    purpose: "purpose",
    dateIssued: "issue_date",
    validUntil: "expires_on",
    status: "status",
  }
  for (const [heading, serverColumn] of Object.entries(columns)) {
    await page.getByTestId(`sort-${heading}`).click()
    await expect
      .poll(() => last(listCalls(queries.history)).get("sort_by"))
      .toBe(serverColumn)
  }
})
