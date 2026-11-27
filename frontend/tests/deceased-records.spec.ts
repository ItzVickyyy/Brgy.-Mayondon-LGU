// Patch 328: record, correct and void a resident's death from Records, and the
// read-only view for staff. The API is mocked with a small in-memory store
// (synthetic residents), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

type Death = {
  date_of_death: string | null
  date_precision: "day" | "month" | "year" | "unknown"
  evidence: "reported" | "verified"
  source_note: string | null
  age_at_death: number | null
  recorded_at: string
  recorded_by_name: string | null
}

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const staff = {
  ...admin,
  is_superuser: false,
  role: "staff",
  full_name: "Staff",
}

const base = (id: string, first: string, last: string) => ({
  id,
  first_name: first,
  middle_name: null,
  last_name: last,
  suffix: null,
  full_name: `${first} ${last}`,
  birthdate: "1950-05-12",
  birth_place: null,
  sex: "Female",
  civil_status: "Married",
  occupation: null,
  house_number: "5",
  street_id: null,
  purok: 2,
  resident_since_year: null,
  resident_since_birth: true,
  resident_type: null,
  id_number: null,
  voter_registration: "unregistered",
  residency_type: "new",
  emergency_contact_name: null,
  emergency_contact_address: null,
  emergency_contact_phone: null,
  age: 76,
  sector_ids: [],
  has_photo: false,
  id_status: "none",
  id_valid_until: null,
  id_validity_months: 6,
  voter_proof_verified_at: null,
  voter_proof_verified_by_name: null,
  archive_reason: null,
  archived_at: null,
  archived_by_name: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

const ANA = "aaaaaaaa-0000-0000-0000-000000000001"
const BEA = "bbbbbbbb-0000-0000-0000-000000000002"

function makeStore() {
  const rows: Record<
    string,
    ReturnType<typeof base> & { status: string; death: Death | null }
  > = {
    [ANA]: { ...base(ANA, "Ana", "Reyes"), status: "active", death: null },
    [BEA]: {
      ...base(BEA, "Bea", "Cruz"),
      status: "deceased",
      death: {
        date_of_death: "2026-03-14",
        date_precision: "day",
        evidence: "verified",
        source_note: "Death certificate seen",
        age_at_death: 75,
        recorded_at: "2026-03-20T01:00:00Z",
        recorded_by_name: "Test Admin",
      },
    },
  }
  const calls: { method: string; path: string; body: unknown }[] = []
  return { rows, calls }
}

async function mockApi(
  page: Page,
  user: typeof admin,
  store: ReturnType<typeof makeStore>,
  language = "en",
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    if (path.endsWith("/users/me")) return json(user)
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })

    const match = path.match(/\/residents\/([0-9a-f-]{36})\/deceased(\/void)?$/)
    if (match) {
      const row = store.rows[match[1]]
      const body = request.postDataJSON()
      store.calls.push({ method, path, body })
      if (match[2]) {
        row.status = "active"
        row.death = null
      } else {
        row.status = "deceased"
        row.death = {
          date_of_death: body.date_of_death,
          date_precision: body.date_precision,
          evidence: body.evidence,
          source_note: body.source_note,
          age_at_death: 75,
          recorded_at: "2026-11-27T01:00:00Z",
          recorded_by_name: "Test Admin",
        }
      }
      return json(row)
    }
    if (path.endsWith("/residents/") && method === "GET") {
      const wanted = url.searchParams.get("status") ?? "active"
      const data = Object.values(store.rows).filter((r) => r.status === wanted)
      return json({ data, count: data.length })
    }
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((lang) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", lang)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
}

test("an administrator records a death from the profile", async ({ page }) => {
  const store = makeStore()
  await mockApi(page, admin, store)
  await page.goto("/records")

  const row = page.getByRole("row", { name: /Ana Reyes/ })
  await row.getByRole("button", { name: "View", exact: true }).click()
  await page.getByTestId("profile-record-death").click()

  const dialog = page.getByRole("dialog", { name: "Record a death" })
  await expect(dialog).toBeVisible()
  // Nothing can be saved before a date is entered.
  await expect(dialog.getByTestId("death-submit")).toBeDisabled()
  await dialog.getByTestId("death-date").fill("2026-03-14")
  await dialog.getByTestId("death-evidence-verified").check()
  await dialog.getByTestId("death-note").fill("Death certificate seen")
  await expect(dialog.getByTestId("death-submit")).toBeEnabled()
  await dialog.getByTestId("death-submit").click()

  await expect(page.getByTestId("deceased-banner")).toBeVisible()
  expect(store.calls).toEqual([
    {
      method: "POST",
      path: `/api/v1/residents/${ANA}/deceased`,
      body: {
        date_precision: "day",
        date_of_death: "2026-03-14",
        evidence: "verified",
        source_note: "Death certificate seen",
      },
    },
  ])
  // The profile of a deceased resident offers no Edit.
  await expect(page.getByTestId("profile-edit")).toHaveCount(0)
})

test("a date in the future or before the birthdate is refused before saving", async ({
  page,
}) => {
  const store = makeStore()
  await mockApi(page, admin, store)
  await page.goto("/records")
  await page
    .getByRole("row", { name: /Ana Reyes/ })
    .getByRole("button", { name: "More actions for Ana Reyes" })
    .click()
  await page.getByRole("menuitem", { name: "Record death" }).click()
  const dialog = page.getByRole("dialog", { name: "Record a death" })
  await chooseOption(dialog.getByTestId("death-precision"), "Year only")
  await dialog.getByTestId("death-date").fill("1940")
  await expect(dialog.getByRole("alert")).toContainText("before the birthdate")
  await expect(dialog.getByTestId("death-submit")).toBeDisabled()
  await dialog.getByTestId("death-date").fill("2999")
  await expect(dialog.getByRole("alert")).toContainText("future")
  await dialog.getByTestId("death-date").fill("2020")
  await expect(dialog.getByTestId("death-submit")).toBeEnabled()
  expect(store.calls).toEqual([])
})

test("an administrator corrects a death record; saving needs a change and a reason", async ({
  page,
}) => {
  const store = makeStore()
  await mockApi(page, admin, store)
  await page.goto("/records")
  await page.getByRole("tab", { name: "Deceased" }).click()
  const row = page.getByTestId("deceased-row").filter({ hasText: "Bea Cruz" })
  await expect(row).toContainText("Verified")
  await row.getByRole("button", { name: "More actions for Bea Cruz" }).click()
  await page.getByRole("menuitem", { name: "Correct death record" }).click()

  const dialog = page.getByRole("dialog", { name: "Correct death record" })
  await expect(dialog.getByTestId("death-submit")).toBeDisabled()
  await dialog.getByTestId("death-evidence-reported").check()
  // Changed, but the reason is still missing.
  await expect(dialog.getByTestId("death-submit")).toBeDisabled()
  await dialog.getByTestId("death-reason").fill("Certificate was not seen")
  await expect(dialog.getByTestId("death-submit")).toBeEnabled()
  await dialog.getByTestId("death-submit").click()

  await expect(row).toContainText("Reported")
  expect(store.calls).toEqual([
    {
      method: "PUT",
      path: `/api/v1/residents/${BEA}/deceased`,
      body: {
        date_precision: "day",
        date_of_death: "2026-03-14",
        evidence: "reported",
        source_note: "Death certificate seen",
        reason: "Certificate was not seen",
      },
    },
  ])
})

test("an administrator voids a death recorded by mistake", async ({ page }) => {
  const store = makeStore()
  await mockApi(page, admin, store)
  await page.goto("/records")
  await page.getByRole("tab", { name: "Deceased" }).click()
  await page
    .getByTestId("deceased-row")
    .getByRole("button", { name: "More actions for Bea Cruz" })
    .click()
  await page.getByRole("menuitem", { name: "Void death record" }).click()

  const dialog = page.getByRole("dialog", { name: "Void death record?" })
  const confirm = dialog.getByRole("button", { name: "Void death record" })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Reason/).fill("Same name, wrong person")
  await confirm.click()

  await expect(page.getByText("No deceased residents recorded")).toBeVisible()
  expect(store.calls).toEqual([
    {
      method: "POST",
      path: `/api/v1/residents/${BEA}/deceased/void`,
      body: { reason: "Same name, wrong person" },
    },
  ])
})

test("staff can read deceased records but cannot change them", async ({
  page,
}) => {
  const store = makeStore()
  await mockApi(page, staff, store)
  await page.goto("/records")
  // No Record death in the menu of an active resident.
  await expect(
    page
      .getByRole("row", { name: /Ana Reyes/ })
      .getByRole("button", { name: "More actions for Ana Reyes" }),
  ).toHaveCount(0)

  await page.getByRole("tab", { name: "Deceased" }).click()
  const row = page.getByTestId("deceased-row").filter({ hasText: "Bea Cruz" })
  await expect(row).toBeVisible()
  await expect(
    row.getByRole("button", { name: "More actions for Bea Cruz" }),
  ).toHaveCount(0)
  await row.getByRole("button", { name: "View", exact: true }).click()
  await expect(page.getByTestId("deceased-banner")).toBeVisible()
  await expect(page.getByTestId("profile-correct-death")).toHaveCount(0)
  await expect(page.getByTestId("profile-void-death")).toHaveCount(0)
  await expect(page.getByTestId("profile-edit")).toHaveCount(0)
  expect(store.calls).toEqual([])
})
