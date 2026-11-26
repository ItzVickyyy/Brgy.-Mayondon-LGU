import { expect, test } from "@playwright/test"

// User Accounts (patch 311). The list needs about 1171 px (English) or 1277 px (Filipino), but
// its box is 972 px on a 1280 px laptop, so the sticky Actions column slid over Role and Status.
// Below 80rem the list is now cards, so nothing scrolls sideways at any width and every user's
// role, status and buttons can be read.
const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
  must_change_password: false,
  password_expired: false,
}
const user = (i: number, extra: object) => ({
  id: `22222222-0000-0000-0000-00000000010${i}`,
  is_active: true,
  is_superuser: false,
  role: "staff",
  must_change_password: false,
  locked_until: null,
  ...extra,
})
const users = {
  count: 3,
  data: [
    user(1, {
      email: "admin@example.com",
      full_name: "Test Admin",
      is_superuser: true,
      role: "admin",
    }),
    user(2, {
      email: "mcdelacruz@mayondon.gov.ph",
      full_name: "Maria Cristina Dela Cruz",
      must_change_password: true,
    }),
    user(3, {
      email: "lorna.alcantara@example.com",
      full_name: "Lorna Santos Alcantara",
      is_active: false,
      locked_until: "2026-11-27T10:30:00Z",
    }),
  ],
}

for (const language of ["en", "fil"])
  for (const width of [1920, 1600, 1520, 1440, 1280, 1024, 390])
    test(`User Accounts fits ${width} px without scrolling (${language})`, async ({
      page,
    }) => {
      await page.route("**/api/v1/**", (route) => {
        const url = route.request().url()
        const json = (body: unknown) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          })
        if (url.includes("/users/me")) return json(admin)
        if (url.includes("/users/")) return json(users)
        return json({ data: [], count: 0 })
      })
      await page.addInitScript((lang) => {
        localStorage.setItem("access_token", "test-token")
        localStorage.setItem("app-language", lang)
      }, language)
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/admin")
      const table = page.locator("table").first()
      await expect(table.locator("tbody tr").first()).toBeVisible()
      const over = await table.evaluate((el) => {
        const box = el.closest(".overflow-x-auto") as HTMLElement
        return box.scrollWidth - box.clientWidth
      })
      expect(over).toBeLessThanOrEqual(1)
      // Every row's last button stays inside the screen.
      const edges = await table.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => {
          const buttons = row.querySelectorAll("button")
          const last = buttons[buttons.length - 1]
          return last ? last.getBoundingClientRect().right : 0
        }),
      )
      for (const edge of edges) expect(edge).toBeLessThanOrEqual(width)
    })
