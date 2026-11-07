import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

test("The old /welcome address goes to staff login", async ({ page }) => {
  await page.goto("/welcome")
  await expect(page).toHaveURL(/login$/)
})

test("Unauthenticated visitors to the dashboard reach staff login", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveURL(/login$/)
})
