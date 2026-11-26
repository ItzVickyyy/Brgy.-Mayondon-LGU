import { expect, test } from "@playwright/test"

// Backup History on a phone (patch 310): every backup is a card. Before, the table was 900 px
// wide and the sticky Actions cell (about 400 px) covered every other column, so a backup
// could not be ticked or even read.
const admin = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  full_name: "Admin",
  role: "admin",
  is_active: true,
  is_superuser: true,
  must_change_password: false,
  password_expired: false,
}

const run = (day: number, verified: boolean) => ({
  id: `00000000-0000-0000-0000-0000000001${day}`,
  started_at: `2026-11-${day}T09:00:00Z`,
  finished_at: `2026-11-${day}T09:01:00Z`,
  kind: "manual",
  status: "ok",
  file_name: `mayondon-202611${day}-0900.dump.enc`,
  size_bytes: 1234567,
  verified_at: verified ? `2026-11-${day}T09:05:00Z` : null,
  created_by_email: "admin@example.com",
  error: null,
  file_exists: true,
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "mock")
    localStorage.setItem("app-language", "en")
  })
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url()
    if (url.includes("/backups/")) {
      return route.fulfill({
        json: {
          data: [run(21, true), run(22, false)],
          count: 2,
          tool_available: true,
          keep_copies: 14,
        },
      })
    }
    if (url.includes("/users/me") && !url.includes("preferences")) {
      return route.fulfill({ json: admin })
    }
    return route.fulfill({
      json: { data: [], count: 0, total_issued: 0, by_document_type: [] },
    })
  })
})

test("on a phone each backup is a card that can be ticked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto("/backup-restore")
  const box = page.locator("table").locator("xpath=..")
  const body = page.locator("tbody")
  await expect(body.getByText("mayondon-20261121-0900.dump.enc")).toBeVisible()
  // Nothing scrolls sideways.
  const sizes = await box.evaluate((el) => [el.clientWidth, el.scrollWidth])
  expect(sizes[1]).toBeLessThanOrEqual(sizes[0])
  // The checkbox is the element a tap would reach, not hidden under Actions.
  const tick = body.getByRole("checkbox").first()
  await expect(tick).toBeVisible()
  await tick.scrollIntoViewIfNeeded()
  const reachable = await tick.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return hit === el || el.contains(hit) || !!hit?.contains(el)
  })
  expect(reachable).toBe(true)
  // The buttons stay inside the card.
  const restore = body.getByRole("button", { name: "Restore" }).first()
  const rb = await restore.boundingBox()
  expect(rb?.x ?? -1).toBeGreaterThanOrEqual(0)
})

test("a wide screen keeps the table with its header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/backup-restore")
  await expect(
    page.getByRole("columnheader", { name: /Backup/ }).first(),
  ).toBeVisible()
})
