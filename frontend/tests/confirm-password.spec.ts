// Restore and Download copy ask for the password again (patch 253). Restore takes the word and the
// password in one pop-up (spec brought up to date in patch 313).
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

const backup = {
  id: "00000000-0000-0000-0000-000000000001",
  started_at: "2026-11-20T01:38:44.962818Z",
  finished_at: "2026-11-20T01:38:45.962818Z",
  kind: "manual",
  status: "ok",
  file_name: "mayondon-db-20261120-093844-001.dump",
  size_bytes: 2048,
  verified_at: "2026-11-20T01:38:45.962818Z",
  created_by_email: "admin@example.com",
  error: null,
  file_exists: true,
}

type Seen = {
  confirms: { password: string; scope: string }[]
  restoreToken: string | undefined
  downloadToken: string | undefined
}

async function mockApi(page: Page): Promise<Seen> {
  const seen: Seen = {
    confirms: [],
    restoreToken: undefined,
    downloadToken: undefined,
  }
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const request = route.request()
    const url = request.url()
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/login/confirm-password")) {
      const body = request.postDataJSON() as { password: string; scope: string }
      seen.confirms.push(body)
      if (body.password !== "right-password")
        return json({ detail: "Incorrect password" }, 400)
      return json({
        confirm_token: `token-for-${body.scope}`,
        expires_in_seconds: 120,
      })
    }
    if (url.includes("/restore-request")) {
      seen.restoreToken = request.headers()["x-confirm-token"]
      return json({
        file_name: backup.file_name,
        command: `.\\scripts\\restore-db.ps1 -BackupFile .\\backups\\${backup.file_name}`,
      })
    }
    if (url.includes("/download")) {
      seen.downloadToken = request.headers()["x-confirm-token"]
      return route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: "PGDMP",
      })
    }
    if (url.includes("/backups/"))
      return json({
        data: [backup],
        count: 1,
        tool_available: true,
        keep_copies: 14,
      })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  return seen
}

test("Download copy asks for the password and sends the token", async ({
  page,
}) => {
  const seen = await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByRole("button", { name: "Download copy" }).click()
  const dialog = page.getByTestId("confirm-password-dialog")
  await expect(dialog).toBeVisible()
  expect(seen.downloadToken).toBeUndefined()

  // A wrong password keeps the box open, shows why, and downloads nothing.
  await page.getByTestId("confirm-password-input").fill("wrong")
  await page.getByTestId("confirm-password-submit").click()
  await expect(page.getByTestId("confirm-password-error")).toHaveText(
    "Incorrect password",
  )
  await expect(dialog).toBeVisible()
  await expect(page.getByTestId("confirm-password-input")).toHaveValue("")
  expect(seen.downloadToken).toBeUndefined()

  const downloadPromise = page.waitForEvent("download")
  await page.getByTestId("confirm-password-input").fill("right-password")
  await page.getByTestId("confirm-password-submit").click()
  await downloadPromise
  await expect(dialog).toHaveCount(0)
  expect(seen.downloadToken).toBe("token-for-backup.download")
  expect(seen.confirms[seen.confirms.length - 1]?.scope).toBe("backup.download")
})

test("Restore takes the word and the password in one pop-up, then shows the command", async ({
  page,
}) => {
  const seen = await mockApi(page)
  await page.goto("/backup-restore")
  await expect(
    page.getByRole("cell", { name: backup.file_name, exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await page.getByPlaceholder("RESTORE").fill("RESTORE")
  const confirm = page.getByRole("button", { name: "Check and Show Command" })
  // The button waits for the password as well as the word.
  await expect(confirm).toBeDisabled()
  expect(seen.restoreToken).toBeUndefined()

  await page.getByTestId("restore-password").fill("right-password")
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByText("Ready to restore")).toBeVisible()
  expect(seen.restoreToken).toBe("token-for-backup.restore")
})

test("a wrong password stays in the Restore pop-up as a message and keeps the word", async ({
  page,
}) => {
  const seen = await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await page.getByPlaceholder("RESTORE").fill("RESTORE")
  await page.getByTestId("restore-password").fill("wrong")
  await page.getByRole("button", { name: "Check and Show Command" }).click()
  await expect(page.getByTestId("restore-password-error")).toHaveText(
    "Incorrect password",
  )
  await expect(page.getByPlaceholder("RESTORE")).toHaveValue("RESTORE")
  await expect(page.getByTestId("restore-password")).toHaveValue("")
  expect(seen.restoreToken).toBeUndefined()
})

test("Cancel closes the box and nothing is sent", async ({ page }) => {
  const seen = await mockApi(page)
  await page.goto("/backup-restore")
  await page.getByRole("button", { name: "Download copy" }).click()
  await page.getByTestId("confirm-password-cancel").click()
  await expect(page.getByTestId("confirm-password-dialog")).toHaveCount(0)
  expect(seen.confirms).toHaveLength(0)
  expect(seen.downloadToken).toBeUndefined()
})

test("an expired confirmation does not sign the person out", async ({
  page,
}) => {
  await mockApi(page)
  await page.route("**/api/v1/backups/*/restore-request", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        detail: {
          code: "password_confirmation_required",
          message: "Type your password again to continue.",
        },
      }),
    }),
  )
  await page.goto("/backup-restore")
  await expect(
    page.getByRole("cell", { name: backup.file_name, exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await page.getByPlaceholder("RESTORE").fill("RESTORE")
  await page.getByTestId("restore-password").fill("right-password")
  await page.getByRole("button", { name: "Check and Show Command" }).click()
  // The refusal is shown as a message; the session stays.
  await expect(
    page.getByText("Type your password again to continue."),
  ).toBeVisible()
  await expect(page).toHaveURL(/backup-restore/)
  expect(await page.evaluate(() => localStorage.getItem("access_token"))).toBe(
    "test-token",
  )
})
