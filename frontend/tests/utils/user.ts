import { expect, type Page } from "@playwright/test"

export async function logInUser(page: Page, email: string, password: string) {
  await page.goto("/login")

  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("/")
  await expect(
    page.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible()
}

export async function logOutUser(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Log out" }).click()
  await page.waitForURL(/\/login$/)
}
