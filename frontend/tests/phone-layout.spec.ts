// Phone-width details of two pop-ups (patch 275). (1) The New Issuance footer
// hint ("Saves as a draft automatically once you choose a person") was one line
// cut off with an ellipsis at 390 px; it must wrap there and show whole.
// (2) The Issuance settings tab row scrolls sideways at 390 px with nothing to
// show it, so a fade marks the clipped right edge. The API is mocked, so this
// spec needs only the running frontend (run with --no-deps).
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

async function open(page: Page, language: string, width: number) {
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
  await page.addInitScript((lang) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", lang)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
  await page.setViewportSize({ width, height: 800 })
  await page.goto("/issuances")
}

for (const language of ["en", "fil"]) {
  test(`New Issuance footer hint wraps and is not cut off at 390 px (${language})`, async ({
    page,
  }) => {
    await open(page, language, 390)
    await page
      .getByRole("button", { name: /New Issuance|Bagong Isyu/ })
      .first()
      .click()
    const hint = page.getByTestId("autosave-status")
    await expect(hint).toBeVisible()
    const text = hint.locator("span").nth(1)
    const cut = await text.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(cut).toBeLessThanOrEqual(1)
    const lineHeight = await text.evaluate(
      (el) => Number.parseFloat(getComputedStyle(el).lineHeight) || 16,
    )
    const height = (await text.boundingBox())!.height
    expect(height).toBeGreaterThan(lineHeight * 1.5)
  })

  test(`New Issuance footer hint stays one line from 640 px up (${language})`, async ({
    page,
  }) => {
    await open(page, language, 1280)
    await page
      .getByRole("button", { name: /New Issuance|Bagong Isyu/ })
      .first()
      .click()
    const text = page.getByTestId("autosave-status").locator("span").nth(1)
    await expect(text).toBeVisible()
    const lineHeight = await text.evaluate(
      (el) => Number.parseFloat(getComputedStyle(el).lineHeight) || 16,
    )
    expect((await text.boundingBox())!.height).toBeLessThan(lineHeight * 1.5)
  })

  test(`Issuance settings tab row shows a fade on the clipped edge at 390 px (${language})`, async ({
    page,
  }) => {
    await open(page, language, 390)
    await page
      .getByRole("button", { name: /Issuance settings|Mga setting ng isyu/ })
      .click()
    const dialog = page.getByTestId("issuance-settings")
    const row = dialog.getByRole("tablist")
    const scrolls = await row.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(scrolls).toBe(true)
    const fade = dialog.getByTestId("settings-tabs-fade")
    await expect(fade).toBeVisible()
    const rowBox = (await row.boundingBox())!
    const fadeBox = (await fade.boundingBox())!
    // The pop-up may still be settling its opening motion: allow 2 px.
    expect(
      Math.abs(fadeBox.x + fadeBox.width - (rowBox.x + rowBox.width)),
    ).toBeLessThanOrEqual(2)
    // The fade is decoration: it never takes a tap away from a tab.
    expect(
      await fade.evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe("none")
  })

  test(`Issuance settings tab row has no fade on a laptop screen (${language})`, async ({
    page,
  }) => {
    await open(page, language, 1280)
    await page
      .getByRole("button", { name: /Issuance settings|Mga setting ng isyu/ })
      .click()
    const dialog = page.getByTestId("issuance-settings")
    await expect(dialog.getByRole("tablist")).toBeVisible()
    await expect(dialog.getByTestId("settings-tabs-fade")).toBeHidden()
  })
}
