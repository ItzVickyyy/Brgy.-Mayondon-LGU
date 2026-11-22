// The Update button in the notification bell (patch 206). The API is mocked (synthetic data), so this
// spec needs only the running frontend. The computer's update service is played by `status`.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const staff = { ...admin, role: "staff", is_superuser: false }

type Status = {
  watcher_running: boolean
  state: string
  installed: string
  target: string
  checked_at: string | null
  requested: boolean
  message: string
}
const available: Status = {
  watcher_running: true,
  state: "available",
  installed: "1111111",
  target: "2222222",
  checked_at: new Date().toISOString(),
  requested: false,
  message: "",
}

async function mockApi(page: Page, user: object, status: () => Status) {
  const calls = { status: 0, request: 0 }
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(user)
    if (path.endsWith("/system/update/request")) {
      calls.request += 1
      return json({ ...status(), requested: true })
    }
    if (path.endsWith("/system/update")) {
      calls.status += 1
      return json(status())
    }
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  return calls
}

async function openBell(page: Page) {
  await page.goto("/")
  await page.getByTestId("notification-bell").click()
}

test("an administrator sees the new version in the bell and can install it now", async ({
  page,
}) => {
  test.setTimeout(60_000)
  let current: Status = available
  const calls = await mockApi(page, admin, () => current)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBell(page)

  const reminder = page.getByTestId("update-reminder")
  await expect(reminder).toBeVisible()
  await expect(reminder).toContainText("A new version is ready")
  await expect(reminder).toContainText("tonight")
  await reminder.getByRole("button", { name: "Update" }).click()

  const dialog = page.getByTestId("update-dialog")
  await expect(dialog).toHaveAttribute("data-phase", "confirm")
  await expect(dialog).toContainText("A backup of the database is made first")
  expect(calls.request).toBe(0)

  current = { ...available, requested: true }
  await page.getByTestId("update-confirm").click()
  await expect(dialog).toHaveAttribute("data-phase", "running")
  expect(calls.request).toBe(1)
  // The window cannot be dismissed while the program is being replaced.
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()

  current = { ...available, state: "updating" }
  await expect(dialog).toContainText("Installing the new version", {
    timeout: 15_000,
  })

  current = { ...available, state: "up_to_date", installed: "2222222" }
  await expect(dialog).toHaveAttribute("data-phase", "done", {
    timeout: 15_000,
  })
  await expect(page.getByTestId("update-reload")).toBeVisible()
})

test("a failed update says so and can be closed", async ({ page }) => {
  test.setTimeout(60_000)
  let current: Status = { ...available, state: "updating" }
  await mockApi(page, admin, () => current)
  await openBell(page)

  // Opened while an update is already running: it goes straight to following it.
  const reminder = page.getByTestId("update-reminder")
  await expect(reminder).toContainText("The program is updating")
  await reminder.getByRole("button", { name: "View progress" }).click()
  const dialog = page.getByTestId("update-dialog")
  await expect(dialog).toHaveAttribute("data-phase", "running")

  current = {
    ...available,
    state: "failed",
    message: "The download of 2222222 failed.",
  }
  await expect(dialog).toHaveAttribute("data-phase", "failed", {
    timeout: 15_000,
  })
  await expect(dialog).toContainText("The download of 2222222 failed.")
  await expect(dialog).toContainText("Your records are safe")
  await page.getByTestId("update-close").click()
  await expect(dialog).toHaveCount(0)
})

test("a computer without the update service shows nothing", async ({
  page,
}) => {
  await mockApi(page, admin, () => ({ ...available, watcher_running: false }))
  await openBell(page)
  await expect(page.getByTestId("update-reminder")).toHaveCount(0)
})

test("up to date shows nothing", async ({ page }) => {
  await mockApi(page, admin, () => ({ ...available, state: "up_to_date" }))
  await openBell(page)
  await expect(page.getByTestId("update-reminder")).toHaveCount(0)
})

test("staff never see it and the program never asks about it", async ({
  page,
}) => {
  const calls = await mockApi(page, staff, () => available)
  await openBell(page)
  await expect(page.getByTestId("update-reminder")).toHaveCount(0)
  expect(calls.status).toBe(0)
})

test("Filipino and a phone-width screen fit", async ({ page }) => {
  await mockApi(page, admin, () => available)
  await page.addInitScript(() => localStorage.setItem("app-language", "fil"))
  await page.setViewportSize({ width: 390, height: 800 })
  await openBell(page)
  const reminder = page.getByTestId("update-reminder")
  await expect(reminder).toContainText("May bagong bersyon na")
  await reminder.getByRole("button", { name: "Update" }).click()
  const dialog = page.getByTestId("update-dialog")
  await expect(dialog).toContainText("I-update na ang programa?")
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
})
