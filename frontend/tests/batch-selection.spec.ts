// Batch selection (patch 278) and equal-height cards on Backup and Restore.
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

const run = (n: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  started_at: "2026-11-20T01:38:44.962818Z",
  finished_at: "2026-11-20T01:38:45.962818Z",
  kind: "manual",
  status: "ok",
  file_name: `mayondon-db-20261120-093844-00${n}.dump`,
  size_bytes: 2048,
  verified_at: "2026-11-20T01:38:45.962818Z",
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
        data: [run(1), run(2), run(3)],
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

for (const language of ["en", "fil"]) {
  test(`the three backup cards have the same height (${language})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockApi(page, language)
    await page.goto("/backup-restore")
    const restore = page.getByTestId("restore-card")
    await expect(restore).toBeVisible()
    const grid = restore.locator("xpath=..")
    const heights = await grid
      .locator(":scope > section")
      .evaluateAll((cards) =>
        cards.map((card) => Math.round(card.getBoundingClientRect().height)),
      )
    expect(heights).toHaveLength(3)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  })
}

test("rows can be selected one by one, per page, and cleared", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  const rows = page.getByTestId("row-select")
  await expect(rows).toHaveCount(3)
  await expect(page.getByTestId("selection-bar")).toHaveCount(0)

  await rows.first().click()
  await expect(page.getByTestId("selection-bar")).toContainText("1 selected")

  await page.getByTestId("page-select").click()
  await expect(page.getByTestId("selection-bar")).toContainText("3 selected")

  await page.getByTestId("page-select").click()
  await expect(page.getByTestId("selection-bar")).toHaveCount(0)

  await rows.nth(1).click()
  await page.getByRole("button", { name: "Clear selection" }).click()
  await expect(page.getByTestId("selection-bar")).toHaveCount(0)
})

test("Export selected downloads a CSV of just the selected rows", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByTestId("row-select").nth(1).click()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export selected (CSV)" }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("backups-selected.csv")
  const path = await file.path()
  const { readFileSync } = await import("node:fs")
  const text = readFileSync(path, "utf8")
  expect(text).toContain("mayondon-db-20261120-093844-002.dump")
  expect(text).not.toContain("mayondon-db-20261120-093844-001.dump")
})

test("the header box shows a dash for some rows, and boxes line up (280)", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByTestId("row-select").first().click()
  await expect(page.getByTestId("page-select")).toHaveAttribute(
    "data-state",
    "indeterminate",
  )
  const left = async (selector: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement
      return Math.round(el.getBoundingClientRect().left)
    }, selector)
  const box = await left('[data-testid="row-select"]')
  const head = await left('[data-testid="page-select"]')
  expect(Math.abs(box - head)).toBeLessThanOrEqual(1)
})

for (const [width, height] of [
  [1280, 800],
  [390, 844],
]) {
  test(`selecting a row does not move any row, and the bar stays on screen (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await mockApi(page)
    await page.goto("/backup-restore")
    const rows = page.getByTestId("row-select")
    await expect(rows).toHaveCount(3)
    const tops = () =>
      rows.evaluateAll((boxes) =>
        boxes.map((box) =>
          Math.round(box.getBoundingClientRect().top + window.scrollY),
        ),
      )
    // A DOM click: on a narrow screen the sticky Actions column can sit over
    // the box (pre-existing), and the scroll position must not matter here.
    const pick = (n: number) =>
      rows.nth(n).evaluate((el) => (el as HTMLElement).click())
    const before = await tops()
    await pick(0)
    const bar = page.getByTestId("selection-bar")
    await expect(bar).toBeVisible()
    expect(await tops()).toEqual(before)
    await pick(1)
    await expect(bar).toContainText("2 selected")
    expect(await tops()).toEqual(before)
    const box = await bar.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(0)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height)
    await page.getByRole("button", { name: "Clear" }).click()
    await expect(bar).toHaveCount(0)
    expect(await tops()).toEqual(before)
  })
}
