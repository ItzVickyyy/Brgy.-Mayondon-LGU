// "Signed in on another computer" notice (patches 259 and 263).
// The API is mocked (synthetic data), so this spec needs only the running frontend.
import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

test("a refused token sends the person to the sign-in page with the notice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
  })
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "signed_in_elsewhere" } }),
    }),
  )

  await page.goto("/")

  await expect(page).toHaveURL(/\/login\?elsewhere=1/)
  await expect(page.getByTestId("signed-in-elsewhere")).toContainText(
    "another computer",
  )
  expect(await page.evaluate(() => localStorage.getItem("access_token"))).toBe(
    null,
  )
})

test("the notice shows in Filipino and is absent without the flag", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("app-language", "fil")
  })
  await page.goto("/login?elsewhere=1")
  await expect(page.getByTestId("signed-in-elsewhere")).toContainText(
    "ibang computer",
  )

  await page.goto("/login")
  await expect(page.getByTestId("signed-in-elsewhere")).toHaveCount(0)
})
