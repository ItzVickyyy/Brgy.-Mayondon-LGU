// Records and Archived: a heading click asks the server to sort the whole list
// (315), not just the rows on the page. The API is mocked (synthetic data), so
// this spec needs only the running frontend. The mock answers a sort with an
// odd order: the page must show the rows as received.
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

const resident = (n: number, first: string, status: "active" | "archived") => ({
  first_name: first,
  middle_name: null,
  last_name: "Sorttest",
  suffix: null,
  birthdate: "1980-01-01",
  birth_place: null,
  sex: "Female",
  civil_status: "Single",
  occupation: "Baker",
  house_number: String(n),
  street_id: 1,
  purok: 1,
  resident_since_year: 2000,
  resident_since_birth: false,
  resident_type: null,
  id_number: null,
  voter_registration: "unregistered",
  residency_type: "new",
  emergency_contact_name: null,
  emergency_contact_address: null,
  emergency_contact_phone: null,
  id: `00000000-0000-0000-0000-00000000000${n}`,
  full_name: `${first} Sorttest`,
  age: 46,
  sector_ids: [],
  has_photo: false,
  id_status: "none",
  id_valid_until: null,
  id_validity_months: 6,
  voter_proof_verified_at: null,
  voter_proof_verified_by_name: null,
  status,
  archive_reason: status === "archived" ? "Moved away" : null,
  archived_at: status === "archived" ? "2026-11-20T01:38:19.905795Z" : null,
  archived_by_name: status === "archived" ? "Test Admin" : null,
  created_at: "2026-11-20T01:38:19.905795Z",
  updated_at: "2026-11-20T01:38:19.905806Z",
})

const listFor = (status: "active" | "archived", sorted: boolean) => {
  const rows = [resident(1, "Alpha", status), resident(2, "Bravo", status)]
  return sorted ? rows.reverse() : rows
}

async function mockApi(page: Page, queries: URLSearchParams[]) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/users/me")) return json(admin)
    if (url.pathname.endsWith("/lookups/streets"))
      return json([{ id: 1, name: "Mabini Street" }])
    if (url.pathname.includes("/lookups/")) return json([])
    if (url.pathname.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (url.pathname.endsWith("/residents/")) {
      queries.push(url.searchParams)
      const status =
        url.searchParams.get("status") === "archived" ? "archived" : "active"
      const rows = listFor(status, url.searchParams.has("sort_by"))
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

const queriesFor = (queries: URLSearchParams[], status: string) =>
  queries.filter((q) => q.get("status") === status)

test("Records sorts on the server, cycling ascending, descending, default", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.setViewportSize({ width: 1600, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/records")
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText("Alpha")
  expect(last(queriesFor(queries, "active")).has("sort_by")).toBe(false)

  const heading = page.getByTestId("sort-resident")
  await heading.click()
  await expect(rows.first()).toContainText("Bravo")
  expect(last(queriesFor(queries, "active")).get("sort_by")).toBe("name")
  expect(last(queriesFor(queries, "active")).get("sort_dir")).toBe("asc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "desc")
  await expect
    .poll(() => last(queriesFor(queries, "active")).get("sort_dir"))
    .toBe("desc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "none")
  await expect(rows.first()).toContainText("Alpha")
  expect(last(queriesFor(queries, "active")).has("sort_by")).toBe(false)
})

test("Each Records heading asks for its own server column", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.setViewportSize({ width: 1600, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/records")
  await expect(page.locator("table tbody tr")).toHaveCount(2)
  const columns = {
    resident: "name",
    address: "address",
    birthdate: "birthdate",
    sex: "sex",
    civilStatus: "civil_status",
    occupation: "occupation",
  }
  for (const [heading, serverColumn] of Object.entries(columns)) {
    await page.getByTestId(`sort-${heading}`).click()
    await expect
      .poll(() => last(queriesFor(queries, "active")).get("sort_by"))
      .toBe(serverColumn)
  }
})

test("Each Archived heading asks for its own server column", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.setViewportSize({ width: 1600, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/records")
  await page
    .getByText(/^Archived$/)
    .first()
    .click()
  const rows = page.locator("table tbody tr")
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText("Alpha")
  const columns = {
    resident: "name",
    archivedOn: "archived_at",
    archivedBy: "archived_by",
    reason: "archive_reason",
  }
  for (const [heading, serverColumn] of Object.entries(columns)) {
    await page.getByTestId(`sort-${heading}`).click()
    await expect
      .poll(() => last(queriesFor(queries, "archived")).get("sort_by"))
      .toBe(serverColumn)
  }
  await expect(rows.first()).toContainText("Bravo")
})
