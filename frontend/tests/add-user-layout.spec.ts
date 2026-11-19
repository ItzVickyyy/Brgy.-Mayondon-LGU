// Add User, desktop width: the four name inputs sit on one line in both
// languages, even when a label wraps to two lines (Filipino "Karugtong ng
// pangalan"). The API is mocked, so this spec needs only the running frontend.
import { expect, test } from "@playwright/test"

for (const language of ["en", "fil"]) {
  test(`the four name inputs line up in ${language}`, async ({ page }) => {
    await page.route("**/api/v1/**", async (route) => {
      const json = (body: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        })
      if (route.request().url().includes("/users/me"))
        return json({
          id: "22222222-0000-0000-0000-000000000001",
          email: "admin@example.com",
          is_active: true,
          is_superuser: true,
          role: "admin",
          full_name: "Test Admin",
        })
      return json({ data: [], count: 0 })
    })
    await page.addInitScript((lang) => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", lang)
      localStorage.setItem("vite-ui-theme", "light")
    }, language)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/admin")
    await page.locator("button:has(svg.lucide-plus)").first().click()

    const dialog = page.getByRole("dialog")
    const tops: number[] = []
    for (const name of [
      "first_name",
      "middle_name",
      "last_name",
      "extension_name",
    ]) {
      const box = await dialog.locator(`input[name="${name}"]`).boundingBox()
      expect(box, name).not.toBeNull()
      tops.push(Math.round(box?.y ?? 0))
    }
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1)
  })
}
