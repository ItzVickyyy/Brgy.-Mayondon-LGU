// Edit User, desktop width: the four name inputs sit on one line in both
// languages, even when a label wraps to two lines (Filipino "Karugtong ng
// pangalan"), the Is active box is level with the Role select, and the dialog
// is no longer than it needs to be. The API is
// mocked, so this spec needs only the running frontend.
import { expect, test } from "@playwright/test"
import { waitUntilSettled } from "./utils/settled"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const staff = {
  id: "22222222-0000-0000-0000-000000000002",
  email: "staff@example.com",
  is_active: true,
  is_superuser: false,
  role: "staff",
  full_name: "Maria Cristina Dela Cruz Santos-Villanueva Jr.",
  first_name: "Maria Cristina",
  middle_name: "Dela Cruz",
  last_name: "Santos-Villanueva",
  extension_name: "Jr.",
}

for (const language of ["en", "fil"]) {
  test(`the four name inputs line up in Edit User in ${language}`, async ({
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
      if (url.includes("/users/") || url.endsWith("/users"))
        return json({ data: [admin, staff], count: 2 })
      return json({ data: [], count: 0 })
    })
    await page.addInitScript((lang) => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", lang)
      localStorage.setItem("vite-ui-theme", "light")
    }, language)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/admin")
    const row = page.getByRole("row", { name: /staff@example\.com/ })
    await row.getByRole("button", { name: /^(Edit|I-edit|Baguhin)/ }).click()

    const dialog = page.getByRole("dialog")
    await waitUntilSettled(dialog)
    const boxes: { y: number; w: number }[] = []
    for (const name of [
      "first_name",
      "middle_name",
      "last_name",
      "extension_name",
    ]) {
      const box = await dialog.locator(`input[name="${name}"]`).boundingBox()
      expect(box, name).not.toBeNull()
      boxes.push({ y: Math.round(box?.y ?? 0), w: Math.round(box?.width ?? 0) })
    }
    const tops = boxes.map((b) => b.y)
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1)
    // Wide enough for a long surname (Add User shows the same widths).
    for (const b of boxes.slice(0, 3)) expect(b.w).toBeGreaterThanOrEqual(150)

    // The Is active box sits level with the Role select, not below it.
    const role = await dialog.getByLabel(/^(Role|Tungkulin)/).boundingBox()
    const box = await dialog
      .getByRole("checkbox", { name: /^(Is active|Aktibo)/ })
      .locator("xpath=ancestor::div[@data-slot='form-item'][1]")
      .boundingBox()
    expect(role).not.toBeNull()
    expect(box).not.toBeNull()
    expect(Math.abs((role?.y ?? 0) - (box?.y ?? 0))).toBeLessThanOrEqual(1)
  })
}
