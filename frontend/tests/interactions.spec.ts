import { expect, test } from "@playwright/test"

test.describe("interaction layer", () => {
  test("table rows show a marker on hover and cards pick up the accent", async ({
    page,
  }) => {
    await page.goto("/issuances")
    const row = page.locator("table tbody tr").first()
    if ((await row.count()) > 0) {
      await row.locator("td").first().hover()
      await expect
        .poll(() =>
          row
            .locator("td")
            .first()
            .evaluate((el) => getComputedStyle(el).boxShadow),
        )
        .not.toBe("none")
    }
    await page.goto("/")
    const card = page.locator("article.card-hover").first()
    await expect(card).toBeVisible()
    const before = await card.evaluate((el) => getComputedStyle(el).borderColor)
    await card.hover()
    await expect
      .poll(() => card.evaluate((el) => getComputedStyle(el).borderColor))
      .not.toBe(before)
  })

  test("the bell icon rings on hover", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    const bell = page.getByTestId("notification-bell")
    await expect(bell).toHaveClass(/icon-bell/)
    await bell.hover()
    await expect
      .poll(() =>
        bell
          .locator("svg")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe("bell-ring")
  })

  test("the label of a focused field turns to the accent colour", async ({
    page,
  }) => {
    await page.goto("/admin")
    await page.getByRole("button", { name: /add user/i }).click()
    const dialog = page.getByRole("dialog")
    const label = dialog.locator('[data-slot="form-label"]').first()
    const before = await label.evaluate((el) => getComputedStyle(el).color)
    await dialog.locator("input").first().focus()
    await expect
      .poll(() => label.evaluate((el) => getComputedStyle(el).color))
      .not.toBe(before)
  })

  test("Back to top appears after scrolling and returns to the top", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto("/")
    const button = page.getByTestId("back-to-top")
    await expect(button).toHaveCSS("opacity", "0")
    await page.evaluate(() => window.scrollTo(0, 1200))
    await expect(button).toHaveCSS("opacity", "1")
    await button.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
    await expect(button).toHaveCSS("opacity", "0")
  })

  test("reduced motion switches the movement off", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const bell = page.getByTestId("notification-bell")
    await bell.hover()
    const name = await bell
      .locator("svg")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName)
    expect(name).toBe("none")
  })
})
