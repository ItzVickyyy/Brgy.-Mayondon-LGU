// Notification bell (patch 75): fed by the audit log, filtered by role, read
// state kept per person on the server.

import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi.ts"
import { randomEmail, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

test.use({ storageState: { cookies: [], origins: [] } })

const apiUrl =
  process.env.VITE_API_URL ||
  process.env.API_BASE_URL ||
  "http://127.0.0.1:8000"

async function adminToken(): Promise<string> {
  const response = await fetch(`${apiUrl}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: firstSuperuser,
      password: firstSuperuserPassword,
    }),
  })
  const body = await response.json()
  return body.access_token as string
}

async function renameAsAdmin(userId: string, fullName: string) {
  const token = await adminToken()
  const response = await fetch(`${apiUrl}/api/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ full_name: fullName }),
  })
  expect(response.status).toBe(200)
}

test("a new account starts with nothing unread and no clear-all control", async ({
  page,
}) => {
  const email = randomEmail()
  const password = randomPassword()
  await createUser({ email, password })
  await logInUser(page, email, password)

  await expect(page.getByTestId("notification-bell")).toBeVisible()
  await expect(page.getByTestId("notification-badge")).toHaveCount(0)
  await page.getByTestId("notification-bell").click()
  await expect(page.getByText("No notifications yet")).toBeVisible()
  await expect(page.getByRole("button", { name: /clear all/i })).toHaveCount(0)
})

test("staff see what an administrator did to their account; mark one and mark all", async ({
  page,
}) => {
  const email = randomEmail()
  const password = randomPassword()
  const created = await createUser({ email, password })
  await logInUser(page, email, password)
  await expect(page.getByTestId("notification-badge")).toHaveCount(0)

  await renameAsAdmin(created.id, "First Rename")
  await renameAsAdmin(created.id, "Second Rename")

  // Opening the menu refreshes the list at once.
  await page.getByTestId("notification-bell").click()
  const items = page.getByTestId("notification-item")
  await expect(items).toHaveCount(2)
  await expect(items.first()).toHaveAttribute("data-read", "false")
  await expect(items.first()).toContainText("updated your account")
  await expect(page.getByTestId("notification-badge")).toHaveText("2")

  // Mark one as read.
  await items.first().getByRole("button", { name: "Mark as read" }).click()
  await expect(page.getByTestId("notification-badge")).toHaveText("1")
  await expect(items.first()).toHaveAttribute("data-read", "true")

  // Mark all as read.
  await page.getByRole("button", { name: "Mark all as read" }).click()
  await expect(page.getByTestId("notification-badge")).toHaveCount(0)
  await expect(items.nth(1)).toHaveAttribute("data-read", "true")

  // The read state is kept on the server: it survives a reload.
  await page.reload()
  await expect(page.getByTestId("notification-bell")).toBeVisible()
  await expect(page.getByTestId("notification-badge")).toHaveCount(0)
  await page.getByTestId("notification-bell").click()
  await expect(items).toHaveCount(2)
  await expect(items.first()).toHaveAttribute("data-read", "true")
})

test("staff never see another person's account notices", async ({ page }) => {
  const staffEmail = randomEmail()
  const staffPassword = randomPassword()
  await createUser({ email: staffEmail, password: staffPassword })
  const other = await createUser({
    email: randomEmail(),
    password: randomPassword(),
  })
  await logInUser(page, staffEmail, staffPassword)

  await renameAsAdmin(other.id, "Someone Else")

  await page.getByTestId("notification-bell").click()
  await expect(page.getByText("No notifications yet")).toBeVisible()
  await expect(page.getByTestId("notification-item")).toHaveCount(0)
  await expect(page.getByTestId("notification-badge")).toHaveCount(0)
})

test("the administrator sees account notices for other people", async ({
  page,
}) => {
  const created = await createUser({
    email: randomEmail(),
    password: randomPassword(),
  })
  await renameAsAdmin(created.id, "Visible To Admin")
  await logInUser(page, firstSuperuser, firstSuperuserPassword)

  await page.getByTestId("notification-bell").click()
  await expect(
    page
      .getByTestId("notification-item")
      .filter({ hasText: "Visible To Admin" })
      .first(),
  ).toBeVisible()
})
