// Two-factor sign-in (step 14). Skipped when the server has no
// MFA_ENCRYPTION_KEY (then nobody can turn two-factor on).

import { createHmac } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi.ts"
import { randomEmail, randomPassword } from "./utils/random"

test.use({ storageState: { cookies: [], origins: [] } })

const apiUrl =
  process.env.VITE_API_URL ||
  process.env.API_BASE_URL ||
  "http://127.0.0.1:8000"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function totp(secret: string, offset = 0): string {
  let bits = ""
  for (const ch of secret.replace(/\s/g, "")) {
    bits += ALPHABET.indexOf(ch).toString(2).padStart(5, "0")
  }
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)),
  )
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset))
  const hash = createHmac("sha1", key).update(counter).digest()
  const o = (hash[19] ?? 0) & 15
  const n =
    (((hash[o] ?? 0) & 0x7f) << 24) |
    ((hash[o + 1] ?? 0) << 16) |
    ((hash[o + 2] ?? 0) << 8) |
    (hash[o + 3] ?? 0)
  return String(n % 1_000_000).padStart(6, "0")
}

async function post(path: string, init: RequestInit) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, init)
  return { status: response.status, body: await response.json() }
}

test("sign-in asks for the code after the password, and a wrong code is refused", async ({
  page,
}) => {
  const email = randomEmail()
  const password = randomPassword()
  await createUser({ email, password })
  const first = await post("/login/access-token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  })
  const bearer = { authorization: `Bearer ${first.body.access_token}` }
  const status = await post("/users/me/mfa", { headers: bearer })
  test.skip(!status.body.available, "The server has no MFA_ENCRYPTION_KEY")

  const setup = await post("/users/me/mfa/setup", {
    method: "POST",
    headers: { ...bearer, "content-type": "application/json" },
    body: JSON.stringify({ current_password: password }),
  })
  const secret = setup.body.secret as string
  const enable = await post("/users/me/mfa/enable", {
    method: "POST",
    headers: { ...bearer, "content-type": "application/json" },
    body: JSON.stringify({ code: totp(secret) }),
  })
  expect(enable.status).toBe(200)

  await page.goto("/login")
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByTestId("mfa-code-input")).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem("access_token")),
  ).toBeNull()

  await page.getByTestId("mfa-code-input").fill("000000")
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(page.getByRole("alert").first()).toContainText(
    "The code was not accepted",
  )

  // The enrolment used the current step, so the next one is the first free code.
  await page.getByTestId("mfa-code-input").fill(totp(secret, 1))
  await page.getByRole("button", { name: "Verify" }).click()
  await page.waitForURL("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
})
