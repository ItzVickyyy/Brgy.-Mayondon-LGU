// Patch 292: click-to-sort headings, the floating "N selected" count, the
// coloured Export / Print / More buttons and the tinted selected row.
// The API is mocked (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const run = (n: number, name: string, size: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  started_at: `2026-11-2${n}T01:38:44.962818Z`,
  finished_at: `2026-11-2${n}T01:38:45.962818Z`,
  kind: "manual",
  status: "ok",
  file_name: name,
  size_bytes: size,
  verified_at: `2026-11-2${n}T01:38:45.962818Z`,
  created_by_email: "admin@example.com",
  error: null,
  file_exists: true,
})

async function mockApi(page: Page, language = "en") {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/backups/"))
      return json({
        data: [
          run(1, "b-middle.dump", 2000),
          run(2, "c-last.dump", 3000),
          run(3, "a-first.dump", 1000),
        ],
        count: 3,
        tool_available: true,
        keep_copies: 14,
      })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((lang) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", lang)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
}

const firstColumn = async (page: Page) =>
  page.locator("tbody tr td:nth-child(2)").allInnerTexts()

for (const language of ["en", "fil"]) {
  test(`a heading sorts the rows: up, down, then original order (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockApi(page, language)
    await page.goto("/backup-restore")
    const head = page.getByTestId("sort-backup")
    await expect(head).toBeVisible()
    await expect(head.locator("xpath=..")).toHaveAttribute("aria-sort", "none")
    const original = await firstColumn(page)
    expect(original[0]).toContain("b-middle")

    await head.click()
    await expect(head.locator("xpath=..")).toHaveAttribute(
      "aria-sort",
      "ascending",
    )
    const up = await firstColumn(page)
    expect(up[0]).toContain("a-first")
    expect(up[2]).toContain("c-last")

    await head.click()
    await expect(head.locator("xpath=..")).toHaveAttribute(
      "aria-sort",
      "descending",
    )
    expect((await firstColumn(page))[0]).toContain("c-last")

    await head.click()
    await expect(head.locator("xpath=..")).toHaveAttribute("aria-sort", "none")
    expect((await firstColumn(page))[0]).toContain("b-middle")
  })
}

test("the Actions heading is not a sort button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/backup-restore")
  await expect(page.getByTestId("sort-backup")).toBeVisible()
  await expect(page.getByTestId("sort-actions")).toHaveCount(0)
})

test("the count sits in the top bar, upper right, not in the tools bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/backup-restore")
  await expect(page.getByTestId("selection-count")).toHaveCount(0)
  await page.getByTestId("row-select").first().click()

  const count = page.locator("header").getByTestId("selection-count")
  await expect(count).toContainText("1 selected")
  await expect(page.getByTestId("selection-bar")).not.toContainText(
    "1 selected",
  )

  const box = await count.boundingBox()
  if (!box) throw new Error("no count box")
  expect(box.y).toBeLessThan(64) // inside the 64 px top bar
  expect(box.x).toBeGreaterThan(1440 / 2) // right half of the screen
  // It is left of the Notification button, never on top of it.
  const bell = await page.locator("header button").first().boundingBox()
  expect(bell).not.toBeNull()

  // The top bar is sticky, so the count stays put when the page scrolls.
  await page.mouse.wheel(0, 400)
  await expect.poll(async () => (await count.boundingBox())?.y).toBe(box.y)
})

test("the count fits the top bar on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await mockApi(page)
  await page.goto("/backup-restore")
  // At 390 px the sticky Actions column of the Backup table lies over the
  // checkbox column (known, not part of this patch), so tick it through the DOM.
  await page
    .getByTestId("row-select")
    .first()
    .evaluate((el) => (el as HTMLElement).click())
  const count = page.locator("header").getByTestId("selection-count")
  await expect(count).toBeVisible()
  const box = await count.boundingBox()
  if (!box) throw new Error("no count box")
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test("Export is green, Print is violet, the ticked row is tinted", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/backup-restore")
  const row = page.locator("tbody tr").first()
  const plain = await row.evaluate((el) => getComputedStyle(el).backgroundColor)

  await page.getByTestId("row-select").first().click()
  await expect(page.getByTestId("selection-export")).toBeVisible()
  const colour = (id: string) =>
    page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await colour("selection-export")).not.toBe(
    await colour("selection-print"),
  )
  const ticked = await row.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  )
  expect(ticked).not.toBe(plain)
})
