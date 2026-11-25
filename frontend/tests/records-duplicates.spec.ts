// Adding a resident whose name is only spelled differently from someone on
// record warns and lists who matched; "Save anyway" confirms a real namesake.
// A double click on Add resident makes one record. Needs the running app.
import { expect, test } from "@playwright/test"
import { letterTag } from "./utils/random"

test("a spelling variant is warned about with the match listed, then saved anyway", async ({
  page,
}) => {
  await page.goto("/records")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const tag = letterTag("Dup")
  const made = await page.request.post("/api/v1/residents/", {
    headers,
    data: {
      first_name: "Ana",
      last_name: `De la Peña ${tag}`,
      birthdate: "1990-05-05",
      sex: "Female",
      civil_status: "Single",
    },
  })
  expect(made.status()).toBe(201)

  await page.getByRole("button", { name: "Add Resident" }).first().click()
  await page.locator("#resident-form-first-name").fill("ANA")
  await page.locator("#resident-form-last-name").fill(`Dela Pena${tag}`)
  await page.locator('input[type="date"]').first().fill("1990-05-05")
  await page.getByRole("button", { name: "Add resident", exact: true }).click()

  const matches = page.getByTestId("duplicate-matches")
  await expect(matches).toBeVisible()
  await expect(matches).toContainText(tag)
  await expect(matches).toContainText("born 1990-05-05")

  await page.getByRole("button", { name: "Save anyway" }).click()
  await expect(page.locator("#resident-form-first-name")).toHaveCount(0)
  const list = await page.request.get(
    `/api/v1/residents/?q=${tag}&status=all&limit=20`,
    { headers },
  )
  expect((await list.json()).count).toBe(2)
})

test("a double click on Add resident saves one record", async ({ page }) => {
  await page.goto("/records")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  const headers = { Authorization: `Bearer ${token}` }
  const tag = letterTag("Dbl")
  await page.getByRole("button", { name: "Add Resident" }).first().click()
  await page.locator("#resident-form-first-name").fill("Click")
  await page.locator("#resident-form-last-name").fill(tag)
  await page
    .getByRole("button", { name: "Add resident", exact: true })
    .dblclick()
  await expect(page.locator("#resident-form-first-name")).toHaveCount(0)
  const list = await page.request.get(
    `/api/v1/residents/?q=${tag}&status=all&limit=20`,
    { headers },
  )
  expect((await list.json()).count).toBe(1)
})
