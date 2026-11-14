// Two-factor request (patches 77 and 78): the banner, the administrator's
// "Ask to use it", the recovery codes staying on screen, and the bell notice.
// Skipped when the server has no MFA_ENCRYPTION_KEY.

import { createHmac } from "node:crypto"
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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function totp(secret: string): string {
  let bits = ""
  for (const ch of secret.replace(/\s/g, "")) {
    bits += ALPHABET.indexOf(ch).toString(2).padStart(5, "0")
  }
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)),
  )
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hash = createHmac("sha1", key).update(counter).digest()
  const o = (hash[19] ?? 0) & 15
  const n =
    (((hash[o] ?? 0) & 0x7f) << 24) |
    ((hash[o + 1] ?? 0) << 16) |
    ((hash[o + 2] ?? 0) << 8) |
    (hash[o + 3] ?? 0)
  return String(n % 1_000_000).padStart(6, "0")
}

async function adminHeaders(): Promise<Record<string, string>> {
  const response = await fetch(`${apiUrl}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: firstSuperuser,
      password: firstSuperuserPassword,
    }),
  })
  const body = await response.json()
  return {
    authorization: `Bearer ${body.access_token}`,
    "content-type": "application/json",
  }
}

async function serverHasKey(headers: Record<string, string>) {
  const response = await fetch(`${apiUrl}/api/v1/users/me/mfa`, { headers })
  return (await response.json()).available === true
}

async function ask(userId: string, required: boolean) {
  const response = await fetch(
    `${apiUrl}/api/v1/users/${userId}/mfa-required`,
    {
      method: "PUT",
      headers: await adminHeaders(),
      body: JSON.stringify({ required }),
    },
  )
  expect(response.status).toBe(200)
}

test("a staff member sees the banner only after being asked, enrols from it and keeps the codes", async ({
  page,
}) => {
  test.skip(
    !(await serverHasKey(await adminHeaders())),
    "The server has no MFA_ENCRYPTION_KEY",
  )
  const email = randomEmail()
  const password = randomPassword()
  const created = await createUser({ email, password })
  await logInUser(page, email, password)

  // Not asked yet: no reminder in the bell.
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("notification-bell")).toHaveAttribute(
    "aria-expanded",
    "true",
  )
  await expect(page.getByTestId("two-factor-banner")).toHaveCount(0)
  await page.keyboard.press("Escape")

  // Asked: the banner and a bell notice appear.
  await ask(created.id, true)
  await page.reload()
  const banner = page.getByTestId("two-factor-banner")
  await page.getByTestId("notification-bell").click()
  await expect(banner).toBeVisible()
  await expect(banner).toContainText("An administrator asked you")
  await expect(page.getByTestId("notification-item").first()).toContainText(
    "asked you to use two-factor sign-in",
  )

  // Enrol from the banner. The recovery codes must stay on screen after the
  // banner goes away.
  await banner.getByRole("button", { name: "Set up now" }).click()
  await page.locator("#mfa-setup-password").fill(password)
  await page.getByRole("button", { name: "Continue" }).click()
  const secret = (await page.getByTestId("mfa-secret").innerText()).trim()
  await page.locator("#mfa-setup-code").fill(totp(secret))
  await page.getByRole("button", { name: "Turn on", exact: true }).click()
  await expect(page.getByTestId("mfa-recovery-codes")).toBeVisible()
  await expect(banner).toHaveCount(0)
  await expect(page.getByTestId("mfa-recovery-codes")).toBeVisible()
})

test("the administrator is always shown the banner", async ({ page }) => {
  test.skip(
    !(await serverHasKey(await adminHeaders())),
    "The server has no MFA_ENCRYPTION_KEY",
  )
  await logInUser(page, firstSuperuser, firstSuperuserPassword)
  await page.getByTestId("notification-bell").click()
  await expect(page.getByTestId("two-factor-banner")).toBeVisible()
  await expect(page.getByTestId("two-factor-banner")).toContainText(
    "As an administrator you are always asked",
  )
})

test("the bell shows a short looping message for what needs attention", async ({
  page,
}) => {
  test.skip(
    !(await serverHasKey(await adminHeaders())),
    "The server has no MFA_ENCRYPTION_KEY",
  )
  await logInUser(page, firstSuperuser, firstSuperuserPassword)
  const teaser = page.getByTestId("notification-teaser")
  // It appears, goes away, and appears again (a loop).
  await expect(teaser).toHaveAttribute("data-visible", "true", {
    timeout: 8000,
  })
  await expect(teaser).toHaveAttribute("data-visible", "false", {
    timeout: 8000,
  })
  await expect(teaser).toHaveAttribute("data-visible", "true", {
    timeout: 10000,
  })
  // While the list is open the bubble stays hidden.
  await page.getByTestId("notification-bell").click()
  await expect(teaser).toHaveAttribute("data-visible", "false")
})

test("Edit User can ask a staff person to use two-factor and stop asking", async ({
  page,
}) => {
  test.skip(
    !(await serverHasKey(await adminHeaders())),
    "The server has no MFA_ENCRYPTION_KEY",
  )
  const email = randomEmail()
  await createUser({ email, password: randomPassword() })
  await logInUser(page, firstSuperuser, firstSuperuserPassword)
  await page.goto("/admin")
  await page
    .getByPlaceholder(/search/i)
    .first()
    .fill(email)
    .catch(() => {})
  const row = page.getByRole("row").filter({ hasText: email })
  await row.getByRole("button", { name: "Edit" }).click()

  const box = page.getByTestId("user-mfa-required")
  await expect(box).toContainText("No")
  await box.getByRole("button", { name: "Ask to use it" }).click()
  await expect(box).toContainText("Yes")
  await box.getByRole("button", { name: "Stop asking" }).click()
  await expect(box).toContainText("No")
})
