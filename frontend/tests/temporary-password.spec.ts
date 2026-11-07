import { expect, test } from "@playwright/test"
import { randomEmail, randomPassword } from "./utils/random"

test("temporary password forces a change before the user can access the system", async ({
  page,
}) => {
  const email = randomEmail()
  const temporaryPassword = randomPassword()
  const newPassword = randomPassword()

  await page.goto("/admin")
  await page.getByRole("button", { name: "Add User" }).click()
  await page.getByPlaceholder("Email", { exact: true }).fill(email)
  await page.getByPlaceholder("Full name").fill("Temporary Password Test")
  await page.getByPlaceholder("Password").first().fill(temporaryPassword)
  await page.getByPlaceholder("Password").last().fill(temporaryPassword)
  await page.getByLabel("Is active?").check()
  await page.getByRole("button", { name: "Save" }).click()

  const userRow = page.getByRole("row").filter({ hasText: email })
  await expect(userRow).toBeVisible()
  await expect(userRow.getByText("Temporary password", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "User menu" }).click()
  await page.getByRole("menuitem", { name: "Logout" }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log out" })
    .click()
  await page.waitForURL(/\/login$/)

  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(temporaryPassword)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL(/\/change-password$/)
  await expect(
    page.getByRole("heading", { name: "Change your password" }),
  ).toBeVisible()

  await page.goto("/records")
  await page.waitForURL(/\/change-password$/)

  await page.getByTestId("current-password-input").fill(temporaryPassword)
  await page.getByTestId("new-password-input").fill(newPassword)
  await page.getByTestId("confirm-password-input").fill(newPassword)
  await page.getByRole("button", { name: "Update Password" }).click()
  await page.waitForURL(/\/login\?passwordChanged=1$/)
  await expect(
    page.getByText("Your password has been changed. Sign in again."),
  ).toBeVisible()

  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(newPassword)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
})
