import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi.ts"
import { randomEmail, randomPassword } from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

async function openMyAccount(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "User menu" }).click()
  await page.getByRole("menuitem", { name: "My Account" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "My Account" }),
  ).toBeVisible()
}

test("My Account opens from the user menu", async ({ page }) => {
  await openMyAccount(page)
  await expect(page.getByRole("button", { name: "Edit Account" })).toBeVisible()
})

test("Change Password is available inside My Account edit mode", async ({
  page,
}) => {
  await openMyAccount(page)
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Edit Account" }).click()
  await expect(dialog.getByText("Password & Sign-in")).toBeVisible()
  await expect(dialog.getByTestId("current-password-input")).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "Update Password" }),
  ).toBeVisible()
})

test.describe("Edit user profile", () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  let email: string
  let password: string

  test.beforeAll(async () => {
    email = randomEmail()
    password = randomPassword()
    await createUser({ email, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, email, password)
    await openMyAccount(page)
    await page.getByRole("dialog").getByRole("button", { name: "Edit Account" }).click()
  })

  test("Edit the first name and save the profile", async ({ page }) => {
    const dialog = page.getByRole("dialog")
    const updatedName = "Test User Updated"

    await dialog.getByLabel("First Name").fill(updatedName)
    await dialog.getByRole("button", { name: "Save Changes" }).click()

    await expect(page.getByText("My Account updated successfully")).toBeVisible()
    await expect(dialog.getByText(updatedName, { exact: true }).first()).toBeVisible()
  })

  test("Invalid email is blocked by browser validation", async ({ page }) => {
    const dialog = page.getByRole("dialog")
    const emailInput = dialog.getByLabel("Email")

    await emailInput.fill("not-an-email")
    await expect(emailInput).toHaveJSProperty("validity.valid", false)
  })
})

test.describe("Edit user email", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Edit the email and save the profile", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    const updatedEmail = randomEmail()

    await createUser({ email, password })
    await logInUser(page, email, password)
    await openMyAccount(page)

    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Edit Account" }).click()
    await dialog.getByLabel("Email").fill(updatedEmail)
    await dialog.getByRole("button", { name: "Save Changes" }).click()

    await expect(page.getByText("My Account updated successfully")).toBeVisible()
    await expect(dialog.getByText(updatedEmail, { exact: true }).first()).toBeVisible()
  })
})

test.describe("Cancel edit actions", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Cancel edit restores the original name", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    const user = await createUser({ email, password })

    await logInUser(page, email, password)
    await openMyAccount(page)

    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Edit Account" }).click()
    await dialog.getByLabel("First Name").fill("Changed Name")
    await dialog.getByRole("button", { name: "Cancel Edit" }).click()

    await expect(dialog.getByText(user.full_name as string, { exact: true }).first()).toBeVisible()
  })

  test("Cancel edit restores the original email", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    await createUser({ email, password })

    await logInUser(page, email, password)
    await openMyAccount(page)

    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Edit Account" }).click()
    await dialog.getByLabel("Email").fill(randomEmail())
    await dialog.getByRole("button", { name: "Cancel Edit" }).click()

    await expect(dialog.getByText(email, { exact: true }).first()).toBeVisible()
  })
})

test.describe("Change password", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Update password successfully", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    const newPassword = randomPassword()

    await createUser({ email, password })
    await logInUser(page, email, password)
    await openMyAccount(page)

    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Edit Account" }).click()
    await dialog.getByTestId("current-password-input").fill(password)
    await dialog.getByTestId("new-password-input").fill(newPassword)
    await dialog.getByTestId("confirm-password-input").fill(newPassword)
    await dialog.getByRole("button", { name: "Update Password" }).click()

    await expect(page.getByText("Password updated successfully")).toBeVisible()
    await dialog.getByRole("button", { name: "Close" }).last().click()
    await logOutUser(page)
    await logInUser(page, email, newPassword)
  })
})

test.describe("Change password validation", () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  let email: string
  let password: string

  test.beforeAll(async () => {
    email = randomEmail()
    password = randomPassword()
    await createUser({ email, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, email, password)
    await openMyAccount(page)
    await page.getByRole("dialog").getByRole("button", { name: "Edit Account" }).click()
  })

  test("Reject a password that is too short", async ({ page }) => {
    const dialog = page.getByRole("dialog")

    await dialog.getByTestId("current-password-input").fill(password)
    await dialog.getByTestId("new-password-input").fill("weak")
    await dialog.getByTestId("confirm-password-input").fill("weak")
    await dialog.getByRole("button", { name: "Update Password" }).click()

    await expect(
      dialog.getByText("New password must be at least 12 characters"),
    ).toBeVisible()
  })

  test("Reject passwords that do not match", async ({ page }) => {
    const dialog = page.getByRole("dialog")

    await dialog.getByTestId("current-password-input").fill(password)
    await dialog.getByTestId("new-password-input").fill(randomPassword())
    await dialog.getByTestId("confirm-password-input").fill(randomPassword())
    await dialog.getByRole("button", { name: "Update Password" }).click()

    await expect(dialog.getByText("The passwords don't match")).toBeVisible()
  })
})

test("Appearance toggle is available in the application header", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: /Switch to (light|dark) mode/ }),
  ).toBeVisible()
})

test("User can switch between theme modes", async ({ page }) => {
  await page.goto("/")
  const themeButton = page.getByRole("button", {
    name: /Switch to (light|dark) mode/,
  })
  const initiallyDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  )

  await themeButton.click()

  if (initiallyDark) {
    await expect(page.locator("html")).not.toHaveClass(/dark/)
  } else {
    await expect(page.locator("html")).toHaveClass(/dark/)
  }
})
