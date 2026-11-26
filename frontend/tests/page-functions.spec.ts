// Patch 283: the restore confirmation is a pop-up, and selected rows can be
// printed, copied and (on Backup) verified. The API is mocked (synthetic data).
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

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = route.request().url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/verify")) return json(run(1))
    if (url.includes("/backups/"))
      return json({
        data: [run(1), run(2), run(3)],
        count: 3,
        tool_available: true,
        keep_copies: 14,
      })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
    // Record what the hidden print frame holds, because it is removed afterwards.
    const append = Node.prototype.appendChild
    Node.prototype.appendChild = function <T extends Node>(child: T): T {
      const added = append.call(this, child) as T
      if (child instanceof HTMLIFrameElement) {
        window.setTimeout(() => {
          ;(window as unknown as { __printed: string }).__printed =
            child.contentDocument?.body?.innerText ?? ""
        }, 200)
      }
      return added
    }
  })
}

test("Prepare Restore opens a pop-up, not a panel in the card", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  const prepare = page.getByRole("button", { name: "Prepare Restore" })
  await expect(prepare).toBeDisabled()
  await page.getByTestId("restore-file").first().click()
  await prepare.click()

  const dialog = page.getByTestId("restore-confirm-dialog")
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "Confirm restore" }),
  ).toBeVisible()
  await expect(page.getByTestId("restore-confirm-file")).toContainText(
    "mayondon-db-20261120-093844-001.dump",
  )
  // Nothing is drawn inside the card any more.
  await expect(
    page.getByTestId("restore-card").getByText("Confirm restore"),
  ).toHaveCount(0)

  const confirm = dialog.getByRole("button", { name: "Check and Show Command" })
  await expect(confirm).toBeDisabled()
  await dialog.getByPlaceholder("RESTORE").fill("RESTORE")
  // The word alone is not enough: the password is asked in the same pop-up.
  await expect(confirm).toBeDisabled()
  await dialog.getByTestId("restore-password").fill("secret")
  await expect(confirm).toBeEnabled()
  // One pop-up only: there is no second password box.
  await expect(page.getByTestId("confirm-password-dialog")).toHaveCount(0)

  await dialog.getByTestId("restore-confirm-cancel").click()
  await expect(dialog).toHaveCount(0)
})

test("the row Restore button opens the same pop-up", async ({ page }) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  await page
    .getByRole("button", { name: "Restore", exact: true })
    .first()
    .click()
  await expect(page.getByTestId("restore-confirm-dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("restore-confirm-dialog")).toHaveCount(0)
})

test("Print prints only the chosen rows, and there is no Copy button", async ({
  page,
}) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByTestId("row-select").nth(1).click()

  await page.getByTestId("selection-print").click()
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __printed?: string }).__printed ?? "",
      ),
    )
    .toContain("mayondon-db-20261120-093844-002.dump")
  const printed = await page.evaluate(
    () => (window as unknown as { __printed: string }).__printed,
  )
  expect(printed).not.toContain("mayondon-db-20261120-093844-001.dump")

  await expect(page.getByTestId("selection-copy")).toHaveCount(0)
})

test("Verify selected checks each chosen backup file", async ({ page }) => {
  await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByTestId("page-select").click()
  const verify = page.waitForRequest((request) =>
    request.url().includes("/verify"),
  )
  await page.getByTestId("verify-selected").click()
  await verify
  await expect(page.getByText("3 backups verified")).toBeVisible()
})

test("Get help opens a small menu beside the button with Help and What's new", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/")
  const button = page.getByTestId("sidebar-get-help")
  await button.click()
  const menu = page.getByTestId("get-help-menu")
  await expect(menu).toBeVisible()
  const buttonBox = (await button.boundingBox())!
  const menuBox = (await menu.boundingBox())!
  // Beside the button: to its right, not on top of it.
  expect(menuBox.x).toBeGreaterThanOrEqual(buttonBox.x + buttonBox.width - 2)
  await expect(menu.getByRole("menuitem")).toHaveText(["Help", "What’s new"])

  await menu.getByRole("menuitem", { name: "What’s new" }).click()
  const dialog = page.getByRole("dialog", { name: "What’s new" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId("whats-new-list")).toContainText(
    "Backup and Restore",
  )
  await page.keyboard.press("Escape")

  await button.click()
  await page.getByRole("menuitem", { name: "Help", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Get help" })).toBeVisible()
})

test("the profile menu trigger looks like a button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockApi(page)
  await page.goto("/")
  const trigger = page.getByRole("button", { name: /user menu/i })
  await expect(trigger).toBeVisible()
  const style = await trigger.evaluate((el) => {
    const css = getComputedStyle(el)
    return { border: css.borderTopWidth, radius: css.borderTopLeftRadius }
  })
  expect(style.border).not.toBe("0px")
  expect(style.radius).not.toBe("0px")
})

test("a wrong password stays in the restore pop-up and keeps the typed word", async ({
  page,
}) => {
  await mockApi(page)
  await page.route("**/login/confirm-password", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Incorrect password" }),
    }),
  )
  await page.goto("/backup-restore")
  await page.getByTestId("restore-file").first().click()
  await page.getByRole("button", { name: "Prepare Restore" }).click()
  const dialog = page.getByTestId("restore-confirm-dialog")
  await dialog.getByPlaceholder("RESTORE").fill("RESTORE")
  await dialog.getByTestId("restore-password").fill("wrong")
  await dialog.getByRole("button", { name: "Check and Show Command" }).click()
  await expect(dialog.getByTestId("restore-password-error")).toHaveText(
    "Incorrect password",
  )
  await expect(dialog.getByPlaceholder("RESTORE")).toHaveValue("RESTORE")
  await expect(dialog.getByTestId("restore-password")).toHaveValue("")
})
