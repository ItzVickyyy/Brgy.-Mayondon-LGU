// A screen left idle shows a one-minute warning, then signs out. Needs the
// running app. Uses the browser's fake clock so the test takes seconds.
import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { logInUser } from "./utils/user"

test.use({ storageState: { cookies: [], origins: [] } })

test("idle warning can be dismissed, and idle time signs out", async ({
  page,
}) => {
  await page.clock.install({ time: new Date() })
  await logInUser(page, firstSuperuser, firstSuperuserPassword)

  const warning = page.getByRole("dialog", { name: "Are you still there?" })
  await expect(warning).toHaveCount(0)

  // 29 min 30 s without activity: warning, and a mouse move does not hide it.
  await page.clock.fastForward("29:30")
  await expect(warning).toBeVisible()
  await page.mouse.move(200, 200)
  await page.mouse.move(260, 240)
  await page.waitForTimeout(1500)
  await expect(warning).toBeVisible()

  // The button keeps the person signed in.
  await warning.getByRole("button", { name: "Stay signed in" }).click()
  await expect(warning).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem("access_token")),
  ).not.toBeNull()

  // Past 30 minutes: signed out, token gone, notice on the login page.
  await page.clock.fastForward("31:00")
  await page.waitForURL(/\/login\?idle=1/)
  expect(
    await page.evaluate(() => localStorage.getItem("access_token")),
  ).toBeNull()
  await expect(page.getByRole("status")).toContainText("left idle")
})
