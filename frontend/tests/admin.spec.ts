import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { fillNewUser, saveNewUser } from "./utils/adminUsers"
import { createUser } from "./utils/privateApi"
import { randomEmail, randomPassword } from "./utils/random"
import { chooseOption } from "./utils/select"
import { logInUser } from "./utils/user"

test("Admin page is accessible and shows correct title", async ({ page }) => {
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", { name: "User Accounts", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Manage system users and their access roles."),
  ).toBeVisible()
})

test("Add User button is visible", async ({ page }) => {
  await page.goto("/admin")
  await expect(page.getByRole("button", { name: "Add User" })).toBeVisible()
})

test.describe("Admin user management", () => {
  test("Create a new user successfully", async ({ page }) => {
    await page.goto("/admin")

    const email = randomEmail()

    await page.getByRole("button", { name: "Add User" }).click()

    await fillNewUser(page, { email, first: "Test", last: "User Admin" })

    // Assert the outcome of the operation rather than the transient toast.
    // Toast descriptions can disappear before Playwright observes them.
    await saveNewUser(page)

    // The table is paged; with many users the new one may not be on the first
    // page, so search for it first.
    await page.getByPlaceholder("Search name or email").fill(email)

    const userRow = page.getByRole("row").filter({ hasText: email })
    await expect(userRow).toBeVisible()
  })

  test("Create a superuser", async ({ page }) => {
    await page.goto("/admin")

    const email = randomEmail()

    await page.getByRole("button", { name: "Add User" }).click()

    await fillNewUser(page, { email })

    await chooseOption(
      page.getByRole("dialog").getByLabel("Role"),
      "System Administrator",
    )

    await page.getByLabel("Is active?").check()

    // Verify the persisted role in the table instead of relying on a transient toast.
    await saveNewUser(page)

    await page.getByPlaceholder("Search name or email").fill(email)

    const userRow = page.getByRole("row").filter({ hasText: email })
    await expect(userRow.getByText("System Administrator")).toBeVisible()
  })

  test("Edit a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const email = randomEmail()
    const updatedName = "Updated Name"

    await page.getByRole("button", { name: "Add User" }).click()
    await fillNewUser(page, { email, first: "Original", last: "Name" })
    await saveNewUser(page)

    // Search by e-mail first (the table is paged; see the create test).
    await page.getByPlaceholder("Search name or email").fill(email)

    const userRow = page.getByRole("row").filter({ hasText: email })
    await userRow.getByRole("button", { name: "Edit", exact: true }).click()

    // The name is edited as parts; the row shows them joined.
    await page.getByPlaceholder("Enter first name").fill("Updated")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(userRow.getByText(updatedName)).toBeVisible()
  })

  test("Delete a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const email = randomEmail()

    await page.getByRole("button", { name: "Add User" }).click()
    await fillNewUser(page, { email })
    await saveNewUser(page)

    await page.getByPlaceholder("Search name or email").fill(email)

    const userRow = page.getByRole("row").filter({ hasText: email })
    await userRow.getByRole("button", { name: "Delete User" }).click()

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click()

    await expect(
      page.getByRole("row").filter({ hasText: email }),
    ).not.toBeVisible()
  })

  test("Cancel user creation", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()
    await page
      .getByPlaceholder("Email", { exact: true })
      .fill("test@example.com")

    await page.getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("Email is required and must be valid", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("Email", { exact: true }).fill("invalid-email")
    await page.getByPlaceholder("Email", { exact: true }).blur()

    await expect(page.getByText("Invalid email address")).toBeVisible()
  })
})

test.describe("Admin page access control", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Non-superuser cannot access admin page", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()

    await createUser({ email, password })
    await logInUser(page, email, password)

    await page.goto("/admin")

    await expect(
      page.getByRole("heading", { name: "Access restricted" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "User Accounts", exact: true }),
    ).not.toBeVisible()
  })

  test("Superuser can access admin page", async ({ page }) => {
    await logInUser(page, firstSuperuser, firstSuperuserPassword)

    await page.goto("/admin")

    await expect(
      page.getByRole("heading", { name: "User Accounts", exact: true }),
    ).toBeVisible()
  })
})
