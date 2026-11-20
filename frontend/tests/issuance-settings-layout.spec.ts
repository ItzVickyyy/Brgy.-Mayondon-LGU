// Issuance settings pop-up: the tabs are a vertical sidebar on a laptop screen
// and the pop-up is wide. The API is mocked, so this spec needs only the
// running frontend (run with --no-deps).
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

for (const language of ["en", "fil"]) {
  test(`settings tabs are a left sidebar in a wide pop-up (${language})`, async ({
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
    await page.addInitScript((lang) => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", lang)
      localStorage.setItem("vite-ui-theme", "light")
    }, language)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/issuances")
    await page
      .getByRole("button", { name: /Issuance settings|Mga setting ng isyu/ })
      .click()

    const dialog = page.getByTestId("issuance-settings")
    const tabs = dialog.getByRole("tab")
    await expect(tabs).toHaveCount(9)

    const dialogBox = await dialog.boundingBox()
    expect(dialogBox!.width).toBeGreaterThanOrEqual(1100)

    // All nine tabs share one left edge (a column, not a row) and stack downwards.
    const boxes = await tabs.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right }
      }),
    )
    for (const b of boxes) expect(b.left).toBeCloseTo(boxes[0].left, 0)
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].top)

    // The content sits to the right of the sidebar.
    const panel = await dialog.getByRole("tabpanel").boundingBox()
    expect(panel!.x).toBeGreaterThanOrEqual(
      Math.max(...boxes.map((b) => b.right)),
    )
  })
}
