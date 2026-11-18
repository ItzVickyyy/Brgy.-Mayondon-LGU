import { expect, test } from "@playwright/test"

async function openPreferences(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "User menu" }).click()
  await page.getByRole("menuitem", { name: "Preferences" }).click()
  const dialog = page.getByTestId("preferences-modal")
  await expect(dialog).toBeVisible()
  return dialog
}

const choose = (page: import("@playwright/test").Page, testId: string) =>
  page.locator(`label:has([data-testid="${testId}"])`).click()

const rootFontSize = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize)

test.describe("Preferences", () => {
  test("opens from the user menu, under My Account, with three settings", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "User menu" }).click()
    const items = await page.getByRole("menuitem").allInnerTexts()
    expect(items.indexOf("Preferences")).toBe(items.indexOf("My Account") + 1)
    await page.getByRole("menuitem", { name: "Preferences" }).click()

    const dialog = page.getByTestId("preferences-modal")
    await expect(
      dialog.getByRole("heading", { name: "Preferences" }),
    ).toBeVisible()
    await expect(dialog.getByText("Theme", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Accent colour")).toBeVisible()
    await expect(dialog.getByText("Font size")).toBeVisible()
    // A fixed set only: five accents, no free colour picker.
    await expect(dialog.locator('input[name="pref-accent"]')).toHaveCount(5)
    await expect(dialog.locator('input[type="color"]')).toHaveCount(0)
  })

  test("font size scales the whole app and is remembered", async ({ page }) => {
    await openPreferences(page)
    await choose(page, "pref-size-large")
    expect(await rootFontSize(page)).toBe("18px")
    await choose(page, "pref-size-small")
    expect(await rootFontSize(page)).toBe("14px")

    await page.reload()
    expect(await rootFontSize(page)).toBe("14px")
    const dialog = await openPreferences(page)
    await expect(dialog.getByTestId("pref-size-small")).toBeChecked()

    await choose(page, "pref-size-medium")
    expect(await rootFontSize(page)).toBe("16px")
  })

  test("accent colour changes the primary colour and is remembered", async ({
    page,
  }) => {
    await openPreferences(page)
    const primary = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim(),
      )
    const navy = await primary()

    await choose(page, "pref-accent-teal")
    await expect(page.locator("html")).toHaveAttribute("data-accent", "teal")
    expect(await primary()).not.toBe(navy)

    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-accent", "teal")

    await openPreferences(page)
    await choose(page, "pref-accent-navy")
    await expect(page.locator("html")).not.toHaveAttribute("data-accent")
    expect(await primary()).toBe(navy)
  })

  test("theme can be chosen here and Reset restores the defaults", async ({
    page,
  }) => {
    const dialog = await openPreferences(page)
    await choose(page, "pref-theme-light")
    await expect(page.locator("html")).toHaveClass(/light/)
    await choose(page, "pref-accent-maroon")
    await choose(page, "pref-size-large")

    await dialog.getByRole("button", { name: "Reset to defaults" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.locator("html")).not.toHaveAttribute("data-accent")
    await expect(page.locator("html")).not.toHaveAttribute("data-font-size")
    await expect(dialog.getByTestId("pref-accent-navy")).toBeChecked()
    await dialog.getByRole("button", { name: "Done" }).click()
    await expect(dialog).toBeHidden()
  })

  test("choices are saved per user, in this browser only", async ({ page }) => {
    await openPreferences(page)
    await choose(page, "pref-accent-green")
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("app-preferences:")),
    )
    expect(keys).toHaveLength(1)
    const saved = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k) ?? "{}"),
      keys[0],
    )
    expect(saved.accent).toBe("green")
    // Put it back for the other specs.
    await choose(page, "pref-accent-navy")
  })
})
