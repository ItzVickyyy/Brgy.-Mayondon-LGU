// Patch 282: table rows light up on hover and open "View" on double click, Get help lives in
// the sidebar with its search in the pop-up header, pages have no sub-label under the title,
// and a password older than 3 months sends the person to the change-password screen.
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

const resident = {
  first_name: "Maria Cristina",
  middle_name: "Flores",
  last_name: "Dela Cruz-Villanueva",
  suffix: null,
  birthdate: "1937-08-02",
  birth_place: "Nagcarlan, Laguna",
  sex: "Female",
  civil_status: "Married",
  occupation: "Self-employed (sari-sari store owner)",
  house_number: "197",
  street_id: 3,
  purok: 7,
  resident_since_year: 1966,
  resident_since_birth: false,
  resident_type: null,
  id_number: null,
  voter_registration: "unregistered",
  residency_type: "new",
  emergency_contact_name: null,
  emergency_contact_address: null,
  emergency_contact_phone: null,
  id: "e7d083c5-29b4-402c-bc22-72c418d43c0f",
  full_name: "Maria Cristina Flores Dela Cruz-Villanueva",
  age: 89,
  sector_ids: [],
  has_photo: false,
  id_status: "none",
  id_valid_until: null,
  id_validity_months: 6,
  voter_proof_verified_at: null,
  voter_proof_verified_by_name: null,
  status: "active",
  archive_reason: null,
  archived_at: null,
  archived_by_name: null,
  created_at: "2026-11-20T01:38:19.905795Z",
  updated_at: "2026-11-20T01:38:19.905806Z",
}

async function mockApi(page: Page, me: Record<string, unknown> = admin) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(me)
    if (url.includes("/lookups/")) return json([])
    if (url.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    if (url.includes("/residents/") && !url.includes("/residents/stats"))
      return json({ data: [resident], count: 1 })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test("a Records row lights up on hover and opens View on double click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/records")
  const row = page.locator("tbody tr").first()
  await expect(row).toBeVisible()
  await expect(page.locator("h1 + p")).toHaveCount(0)

  const before = await row.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  )
  await row.hover()
  await expect
    .poll(() => row.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before)
  const bar = await row
    .locator("td")
    .first()
    .evaluate((el) => getComputedStyle(el).boxShadow)
  expect(bar).toBe("none") // background tint only, no accent bar (293)
  await expect(row).toHaveAttribute("data-row-open", "")

  // Double-clicking the selection box only toggles it; it does not open the row.
  await row.getByTestId("row-select").dblclick()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Double-clicking the name opens the resident's profile.
  await row.getByText("Dela Cruz-Villanueva").first().dblclick()
  await expect(page.getByRole("dialog")).toBeVisible()
})

test("Get help is a sidebar button and its search sits in the pop-up header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/")
  await page.getByRole("button", { name: /user menu/i }).click()
  await expect(page.getByRole("menuitem", { name: "Get help" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  const button = page.getByTestId("sidebar-get-help")
  await expect(button).toBeVisible()
  const sidebar = await page
    .locator("[data-sidebar='sidebar']")
    .first()
    .boundingBox()
  const buttonBox = await button.boundingBox()
  expect(buttonBox!.y).toBeGreaterThan(sidebar!.y + sidebar!.height * 0.8)
  await button.click()
  await page.getByRole("menuitem", { name: "Help", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Get help" })
  await expect(dialog).toBeVisible()
  const search = dialog.getByTestId("help-search")
  // Wait for the pop-up's opening motion to finish before measuring.
  let first = await search.boundingBox()
  await expect
    .poll(async () => {
      const now = await search.boundingBox()
      const still = now?.y === first?.y
      first = now
      return still
    })
    .toBe(true)
  await dialog.getByTestId("help-search").fill("password")
  await expect(dialog.getByTestId("help-search-count")).toContainText("match")
  await dialog.getByRole("button", { name: "Clear search" }).click()
  await expect(search).toHaveValue("")
  await expect(dialog.getByTestId("help-search-count")).toHaveText("")

  // The box is part of the fixed header: scrolling the guides does not move it.
  await dialog.evaluate((el) => {
    for (const node of el.querySelectorAll<HTMLElement>("*")) {
      if (node.scrollHeight > node.clientHeight + 40) node.scrollTop = 400
    }
  })
  const after = await search.boundingBox()
  expect(Math.abs(after!.y - first!.y)).toBeLessThanOrEqual(1)
})

test("on a phone, Get help opens its pop-up after the menu closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await mockApi(page)
  await page.goto("/")
  await page.locator("[data-sidebar='trigger']").first().click()
  await page.getByTestId("sidebar-get-help").click()
  await page.getByRole("menuitem", { name: "Help", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Get help" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId("help-search")).toBeVisible()
  // It stays open: the menu closing must not take the pop-up with it.
  await page.waitForTimeout(500)
  await expect(dialog).toBeVisible()
})

test("a password older than 3 months must be changed before anything else", async ({
  page,
}) => {
  await mockApi(page, {
    ...admin,
    password_expired: true,
    password_expires_at: "2026-08-01T00:00:00Z",
  })
  await page.goto("/")
  await expect(page).toHaveURL(/change-password/)
  await expect(
    page.getByRole("heading", { name: "Time to change your password" }),
  ).toBeVisible()
})
