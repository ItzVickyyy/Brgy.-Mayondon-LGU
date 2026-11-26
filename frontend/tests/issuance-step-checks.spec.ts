// Patch 302: a numbered block of New Issuance turns into a check only when the block is truly done: the person
// is chosen, nothing of the resident's record is missing, and the block's own boxes hold values the form accepts.
// Before, "Document details" and "ID presented & payment" showed checks while "Who is it for?" was still open.
// Mocked API, needs only the frontend.
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

const resident = (complete: boolean) => ({
  id: "33333333-0000-0000-0000-000000000001",
  first_name: "Maria",
  middle_name: null,
  last_name: complete ? "Completa" : "Incompleta",
  full_name: complete ? "Maria Completa" : "Maria Incompleta",
  suffix: null,
  birthdate: complete ? "1990-05-04" : null,
  birth_place: complete ? "Los Baños" : null,
  sex: complete ? "Female" : null,
  civil_status: complete ? "Single" : null,
  occupation: null,
  house_number: complete ? "12" : null,
  street_id: complete ? 1 : null,
  purok: complete ? 2 : null,
  resident_since_year: complete ? 2000 : null,
  resident_since_birth: false,
  resident_type: null,
  id_number: null,
  voter_registration: "unregistered",
  residency_type: "regular",
  emergency_contact_name: null,
  emergency_contact_address: null,
  emergency_contact_phone: null,
  age: complete ? 36 : null,
  sector_ids: [],
  has_photo: false,
  id_status: "none",
  id_valid_until: null,
  id_validity_months: 12,
  status: "active",
  archive_reason: null,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

async function openForm(page: Page, complete: boolean) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me/preferences")) return json(null)
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/streets"))
      return json([{ id: 1, name: "Rizal Street" }])
    if (url.includes("/lookups/id-types"))
      return json([{ id: 1, name: "Driver's License" }])
    if (url.includes("/lookups/") || url.includes("/officials")) return json([])
    if (/\/residents\/\?/.test(url))
      return json({ data: [resident(complete)], count: 1 })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto("/issuances")
  await page
    .getByRole("button", { name: /New Issuance/ })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  await expect(page.getByTestId("autosave-status")).toBeVisible()
  await dialog.getByText("Franchise Clearance", { exact: true }).first().click()
  await dialog.locator("#issuance-resident-search").fill("maria")
  await dialog
    .getByText(/Maria (Completa|Incompleta)/)
    .first()
    .click()
  return dialog
}

async function fillEverything(dialog: ReturnType<Page["getByRole"]>) {
  const type = async (id: string, value: string) => {
    await dialog.locator(`#${id}`).fill(value)
    await dialog.locator(`#${id}`).blur()
  }
  await type("issuance-associationName", "Mayondon TODA")
  await type("issuance-make", "Honda")
  await type("issuance-motorNumber", "MN123")
  await type("issuance-color", "Red")
  await type("issuance-plateNumber", "ABC123")
  await chooseOption(dialog.locator("#issuance-idType"), 0)
  await type("issuance-idNumber", "N01-23-456789")
  await type("issuance-idPlaceOfIssue", "Manila")
  await type("issuance-idDateOfIssue", "2024-01-05")
  await type("issuance-officialReceiptNo", "OR-1")
}

const headings = (dialog: ReturnType<Page["getByRole"]>) =>
  dialog.locator("section[id^='issuance-step-'] h3")

test("steps 3 and 4 stay numbers while the resident's record is incomplete", async ({
  page,
}) => {
  const dialog = await openForm(page, false)
  await fillEverything(dialog)
  const list = headings(dialog)
  await expect(list).toHaveCount(4)
  await expect(list.nth(1)).not.toContainText("(complete)")
  await expect(list.nth(2)).not.toContainText("(complete)")
  await expect(list.nth(3)).not.toContainText("(complete)")
})

test("each block turns into a check once it is really filled in, and back when a box is emptied", async ({
  page,
}) => {
  const dialog = await openForm(page, true)
  const list = headings(dialog)
  await expect(list.nth(1)).toContainText("(complete)")
  await expect(list.nth(2)).not.toContainText("(complete)")
  await expect(list.nth(3)).not.toContainText("(complete)")
  await fillEverything(dialog)
  await expect(list.nth(2)).toContainText("(complete)")
  await expect(list.nth(3)).toContainText("(complete)")
  // Spaces only is not a plate number.
  await dialog.locator("#issuance-plateNumber").fill("   ")
  await expect(list.nth(2)).not.toContainText("(complete)")
  await dialog.locator("#issuance-plateNumber").fill("ABC123")
  await expect(list.nth(2)).toContainText("(complete)")
  await dialog.locator("#issuance-officialReceiptNo").fill("")
  await expect(list.nth(3)).not.toContainText("(complete)")
})

// Patch 303: an emptied date on the document must not leave checks on (the box refuses out-of-range typing and keeps
// the last good date, but clearing it is allowed).
test("emptying the date on the document turns the block checks off", async ({
  page,
}) => {
  const dialog = await openForm(page, true)
  const list = headings(dialog)
  await fillEverything(dialog)
  await expect(list.nth(2)).toContainText("(complete)")
  await expect(list.nth(3)).toContainText("(complete)")
  await dialog.locator("#issuance-date").fill("")
  await expect(list.nth(2)).not.toContainText("(complete)")
  await expect(list.nth(3)).not.toContainText("(complete)")
})
