import { expect, test } from "@playwright/test"

test("Dashboard page is accessible", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByText("An overview of document issuance, upcoming expiries, and work requiring attention.")).toBeVisible()
})

test("Issuances Management page is accessible", async ({ page }) => {
  await page.goto("/issuances")
  await expect(page.getByRole("heading", { name: "Issuances Management" })).toBeVisible()
})

test("Records Management page displays sample resident records", async ({ page }) => {
  await page.goto("/records")
  await expect(page.getByRole("heading", { name: "Resident Records" })).toBeVisible()
  await expect(page.getByText("Resident One")).toBeVisible()

  const search = page.getByPlaceholder("Search name, address, ID, or status...")
  await search.fill("Resident One")
  await expect(page.getByText("Resident One")).toBeVisible()
  await expect(page.getByText("Resident Two")).not.toBeVisible()
})

test("Records Management search filters results", async ({ page }) => {
  await page.goto("/records")
  await page.getByPlaceholder("Search name, address, ID, or status...").fill("no-record-matches-this")
  await expect(page.getByText("Resident One")).not.toBeVisible()
})

test("Officials page displays sample officials", async ({ page }) => {
  await page.goto("/officials")
  await expect(page.getByRole("heading", { name: "Officials", exact: true })).toBeVisible()
  await expect(page.getByText("Barangay Captain")).toBeVisible()
})

test("Officials search filters results", async ({ page }) => {
  await page.goto("/officials")
  await page.getByPlaceholder("Search officials...").fill("no-official-matches-this")
  await expect(page.getByText("No matching officials")).toBeVisible()
})

test("Dashboard uses document-focused sample summary cards", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("Documents Issued This Month")).toBeVisible()
  await expect(page.getByText("Clearances Expiring in 30 Days")).toBeVisible()
  await expect(page.getByText("Barangay IDs Expiring in 30 Days")).toBeVisible()
  await expect(page.getByText("Sample Data").first()).toBeVisible()
})

test("Barangay IDs route displays the ID management prototype", async ({ page }) => {
  await page.goto("/barangay-ids")
  await expect(page.getByRole("heading", { name: "Barangay ID Management" })).toBeVisible()
  await expect(page.getByText("Resident One")).toBeVisible()
})

test("Request Access makes clear that submissions are not saved", async ({ page }) => {
  await page.goto("/request-access")
  await expect(page.getByRole("heading", { name: "Request Staff Access" })).toBeVisible()
  await expect(page.getByText("Prototype: this request is not saved.")).toBeVisible()
  await page.getByLabel("Full name").fill("Sample Applicant")
  await page.getByLabel("Barangay office email").fill("sample@example.test")
  await page.getByLabel("Position or office assignment").fill("Office Staff")
  await page.getByRole("button", { name: "Preview Request" }).click()
  await expect(page.getByRole("status")).toContainText("did not submit or save your details")
})

test("Pending Approval shows pending and rejected sample messages", async ({ page }) => {
  await page.goto("/pending-approval")
  await expect(page.getByText("Your account is awaiting approval.")).toBeVisible()
  await expect(page.getByText("Your request was not approved. Please contact the System Administrator.")).toBeVisible()
  await expect(page.getByText(/These messages are examples/)).toBeVisible()
})

test("User account form offers Staff and System Administrator roles", async ({ page }) => {
  await page.goto("/admin")
  await page.getByRole("button", { name: "Add User" }).click()
  const role = page.getByLabel("Role")
  await expect(role).toBeVisible()
  await expect(role.locator("option")).toHaveText(["Staff", "System Administrator"])
})

test("Pending registration decisions are temporary prototype state", async ({ page }) => {
  await page.goto("/pending-registrations")
  await expect(page.getByRole("heading", { name: "Pending Registrations" })).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Approve" }).first().click()
  await expect(page.getByText("Approved").first()).toBeVisible()
  await page.reload()
  await expect(page.getByText("Pending").first()).toBeVisible()
})
