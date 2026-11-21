// Sidebar backdrop (patch 160): quiet marks on the navy sidebar. Decorative
// only: hidden from assistive technology, never catching clicks, free of
// gradients, gone when the sidebar is collapsed, and behind the menu. The API
// is mocked, so this spec needs only the running frontend (run with --no-deps).
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

test("the sidebar marks are decorative, solid and behind the menu", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/lookups/")) return json([])
    if (url.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/issuances")

  const marks = page.getByTestId("sidebar-backdrop")
  await expect(marks).toHaveAttribute("aria-hidden", "true")
  await expect(marks).toHaveCSS("pointer-events", "none")
  await expect(marks).toBeVisible()

  const gradients = await marks.evaluate(
    (el) =>
      [el, ...el.querySelectorAll("*")].filter((node) =>
        getComputedStyle(node).backgroundImage.includes("gradient"),
      ).length,
  )
  expect(gradients).toBe(0)

  // Every menu link stays the topmost element at its centre.
  const links = page.locator('[data-sidebar="menu-button"]')
  const count = await links.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const onTop = await links.nth(i).evaluate((el) => {
      const box = el.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === el || el.contains(hit)
    })
    expect(onTop).toBe(true)
  }

  // Collapsed to icons, the marks are not drawn.
  await page.keyboard.press("Control+b")
  await expect(marks).toBeHidden()
})
