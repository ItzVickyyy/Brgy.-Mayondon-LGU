// Patch 302: opening a pop-up must not move the page behind it. The library that locks the page scroll used to
// add padding for the scrollbar it hides although the page already keeps that space (scrollbar-gutter), so the
// whole main content jumped sideways. Real (non-overlay) scrollbars are switched on so the bug can show.
// Mocked API, needs only the frontend.
import { expect, test } from "@playwright/test"

test.use({
  launchOptions: {
    ignoreDefaultArgs: ["--hide-scrollbars"],
    args: ["--disable-features=OverlayScrollbar"],
  },
})

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

for (const [path, button] of [
  ["/issuances", /New Issuance/],
  ["/records", /Add Resident/],
] as const) {
  test(`${path}: the main content stays where it is when a pop-up opens`, async ({
    page,
  }) => {
    await page.route("**/api/v1/**", async (route) => {
      const json = (body: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        })
      const url = route.request().url()
      if (url.includes("/users/me/preferences")) return json(null)
      if (url.includes("/users/me")) return json(admin)
      if (url.includes("/lookups/") || url.includes("/officials"))
        return json([])
      return json({ data: [], count: 0 })
    })
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", "en")
      localStorage.setItem("vite-ui-theme", "light")
    })
    await page.setViewportSize({ width: 1280, height: 700 })
    await page.goto(path)
    const main = page.locator("#main-content")
    await expect(main.locator("h1").first()).toBeVisible()
    await page.waitForTimeout(400)
    const edges = () =>
      main.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const heading = element.querySelector("h1")?.getBoundingClientRect()
        return [box.left, box.right, heading?.left ?? 0]
      })
    const before = await edges()
    await page.getByRole("button", { name: button }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.waitForTimeout(400)
    expect(await edges()).toEqual(before)
  })
}
