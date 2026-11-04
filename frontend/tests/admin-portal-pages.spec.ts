import { expect, test } from "@playwright/test"

test("Dashboard page is accessible", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(
    page.getByText(
      "An overview of document issuance, upcoming expiries, and work requiring attention.",
    ),
  ).toBeVisible()
})

test("Issuances Management page is accessible", async ({ page }) => {
  await page.goto("/issuances")
  await expect(
    page.getByRole("heading", { name: "Issuance Management" }),
  ).toBeVisible()
})

test("Records Management page starts with an empty resident list", async ({
  page,
}) => {
  await page.goto("/records")
  await expect(
    page.getByRole("heading", { name: "Resident Records" }),
  ).toBeVisible()
  await expect(page.getByText("No matching residents")).toBeVisible()

  const search = page.getByPlaceholder("Search name, address, or ID number...")
  await search.fill("Resident One")
  await expect(page.getByText("No matching residents")).toBeVisible()
})

test("Records Management search filters results", async ({ page }) => {
  await page.goto("/records")
  await page
    .getByPlaceholder("Search name, address, or ID number...")
    .fill("no-record-matches-this")
  await expect(page.getByText("Resident One")).not.toBeVisible()
})

test("Officials page starts with an empty officials list", async ({ page }) => {
  await page.goto("/officials")
  await expect(
    page.getByRole("heading", { name: "Officials", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("No matching officials")).toBeVisible()
})

test("Officials search filters results", async ({ page }) => {
  await page.goto("/officials")
  await page
    .getByPlaceholder("Search officials...")
    .fill("no-official-matches-this")
  await expect(page.getByText("No matching officials")).toBeVisible()
})

test("Dashboard uses document-focused summary cards without a data badge", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page.getByText("Documents Issued This Month")).toBeVisible()
  await expect(page.getByText("Clearances Expiring in 30 Days")).toBeVisible()
  await expect(page.getByText("Barangay IDs Expiring in 30 Days")).toBeVisible()
  await expect(page.getByText("Sample Data")).toHaveCount(0)
})

test("Barangay IDs route displays the ID management page", async ({
  page,
}) => {
  await page.goto("/barangay-ids")
  await expect(
    page.getByRole("heading", { name: "Barangay ID Management" }),
  ).toBeVisible()
  await expect(page.getByText("No ID records match your search")).toBeVisible()
})

test("Request Access presents the staff access form", async ({
  page,
}) => {
  await page.goto("/request-access")
  await expect(
    page.getByRole("heading", { name: "Request Staff Access" }),
  ).toBeVisible()
  await page.getByLabel("Full name").fill("Sample Applicant")
  await page.getByLabel("Barangay office email").fill("sample@example.test")
  await page.getByLabel("Position or office assignment").fill("Office Staff")
  await page.getByRole("button", { name: "Preview Request" }).click()
  await expect(page.getByRole("status")).toContainText(
    "Your request was sent to the System Administrator",
  )
})

test("Pending Approval shows account status guidance", async ({
  page,
}) => {
  await page.goto("/pending-approval")
  await expect(
    page.getByText("Your account is awaiting approval."),
  ).toBeVisible()
  await expect(
    page.getByText(
      "Your request was not approved. Please contact the System Administrator.",
    ),
  ).toBeVisible()
})

test("User account form offers Staff and System Administrator roles", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "Add User" }).click()
  const role = page.getByLabel("Role")
  await expect(role).toBeVisible()
  await expect(role.locator("option")).toHaveText([
    "Staff",
    "System Administrator",
  ])
})

test("Pending Registrations starts with an empty list", async ({ page }) => {
  await page.goto("/pending-registrations")
  await expect(
    page.getByRole("heading", { name: "Pending Registrations" }),
  ).toBeVisible()
  await expect(page.getByText("No registrations found")).toBeVisible()
})


test("Application pages do not display sample or prototype notices", async ({
  page,
}) => {
  const routes = [
    "/",
    "/records",
    "/issuances",
    "/barangay-ids",
    "/officials",
    "/activity-log",
    "/admin",
    "/pending-registrations",
    "/reports",
    "/backup-restore",
    "/request-access",
    "/pending-approval",
    "/login",
  ]

  for (const route of routes) {
    await page.goto(route)
    await expect(
      page.getByText(/sample|prototype/i),
      `Unexpected sample or prototype notice on ${route}`,
    ).toHaveCount(0)
  }
})
