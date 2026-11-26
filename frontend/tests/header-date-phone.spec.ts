import { expect, test } from "@playwright/test"

// At 390 px the header date shares its row with four buttons; the long date used
// to wrap to three lines. A phone shows a short one-line date instead (patch 309).
test.use({ viewport: { width: 390, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "mock")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url()
    if (url.includes("/users/me/preferences")) {
      return route.fulfill({ json: {} })
    }
    if (url.includes("/users/me")) {
      return route.fulfill({
        json: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.com",
          full_name: "Admin",
          role: "administrator",
          is_active: true,
          is_superuser: true,
          must_change_password: false,
          password_expired: false,
        },
      })
    }
    if (url.includes("/dashboard")) {
      return route.fulfill({ json: { total_issued: 0, by_document_type: [] } })
    }
    if (url.includes("/lookups/")) return route.fulfill({ json: [] })
    return route.fulfill({ json: { data: [], count: 0 } })
  })
})

test("the header date is one line on a phone", async ({ page }) => {
  await page.goto("/")
  const short = page.getByTestId("header-date-short")
  await expect(short).toBeVisible()
  await expect(page.getByTestId("header-date")).toBeHidden()
  const box = await short.boundingBox()
  expect(box).not.toBeNull()
  // One line of 12 px text with tight leading is well under 24 px.
  expect(box?.height ?? 99).toBeLessThan(24)
})

test("a wide screen keeps the full date", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await expect(page.getByTestId("header-date")).toBeVisible()
  await expect(page.getByTestId("header-date-short")).toBeHidden()
})
