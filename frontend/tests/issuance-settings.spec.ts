import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"

const randomLetters = (n: number) =>
  Math.random()
    .toString(36)
    .replace(/[^a-z]/g, "")
    .padEnd(n, "q")
    .slice(0, n)

// Issuance settings: the Printing Setup button became Issuance settings. It opens
// a pop-up with Printing setup and, for administrators, the editable lists.

async function adminToken(
  request: import("@playwright/test").APIRequestContext,
) {
  const r = await request.post("/api/v1/login/access-token", {
    form: { username: firstSuperuser, password: firstSuperuserPassword },
  })
  return (await r.json()).access_token as string
}

test.describe("Issuance settings", () => {
  test("the button opens the pop-up with Printing setup and the lists", async ({
    page,
  }) => {
    await page.goto("/issuances")
    await expect(
      page.getByRole("button", { name: "Printing setup" }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Issuance settings" }).click()
    const dialog = page.getByTestId("issuance-settings")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("tab")).toHaveCount(5)
    await expect(dialog.getByTestId("settings-tab-printing")).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await dialog.getByTestId("settings-tab-street").click()
    await expect(dialog.getByRole("heading", { name: "Streets" })).toBeVisible()
  })

  test("an administrator can add, rename and delete a valid ID, and the New Issuance form follows", async ({
    page,
    request,
  }) => {
    const token = await adminToken(request)
    const headers = { Authorization: `Bearer ${token}` }
    const street = await request.post("/api/v1/lookups/streets", {
      headers,
      data: { name: `Settings St ${randomLetters(6)}` },
    })
    const streetId = (await street.json()).id as number
    const last = `Settings${randomLetters(6)}`
    await request.post("/api/v1/residents/", {
      headers,
      data: { first_name: "Sam", last_name: last, street_id: streetId },
    })

    const name = `ZZ ID ${randomLetters(6)}`
    const renamed = `${name} X`

    await page.goto("/issuances")
    await page.getByRole("button", { name: "Issuance settings" }).click()
    const dialog = page.getByTestId("issuance-settings")
    await dialog.getByTestId("settings-tab-idType").click()
    await dialog.getByLabel("New valid ID name").fill(name)
    await dialog.getByRole("button", { name: "Add" }).click()
    await expect(dialog.getByText(name, { exact: true })).toBeVisible()

    await dialog.getByRole("button", { name: `Rename ${name}` }).click()
    await dialog.getByRole("textbox").last().fill(renamed)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog.getByText(renamed, { exact: true })).toBeVisible()
    await page.keyboard.press("Escape")

    // The New Issuance form lists the new name.
    await page.getByRole("button", { name: "New Issuance" }).click()
    const form = page.getByRole("dialog").last()
    await form.getByRole("combobox", { name: /resident/i }).fill(last)
    await page.getByRole("option").first().click()
    await form.locator("label:has(input[type=radio])").nth(0).click()
    const trigger = form.getByRole("button", { name: /Valid ID presented/ })
    await trigger.click()
    await expect(page.getByRole("option", { name: renamed })).toBeVisible()
    // Start again (the form is unsaved), then delete the ID type.
    await page.goto("/issuances")
    await page.getByRole("button", { name: "Issuance settings" }).click()
    const settings = page.getByTestId("issuance-settings")
    await settings.getByTestId("settings-tab-idType").click()
    await settings.getByRole("button", { name: `Delete ${renamed}` }).click()
    await page
      .getByRole("dialog")
      .filter({ hasText: "Delete valid ID?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click()
    await expect(settings.getByText(renamed, { exact: true })).toHaveCount(0)
  })

  test("an administrator can add, rename and delete a sector, and the New Issuance form follows", async ({
    page,
    request,
  }) => {
    const token = await adminToken(request)
    const headers = { Authorization: `Bearer ${token}` }
    const street = await request.post("/api/v1/lookups/streets", {
      headers,
      data: { name: `Sector St ${randomLetters(6)}` },
    })
    const streetId = (await street.json()).id as number
    const last = `Sectors${randomLetters(6)}`
    await request.post("/api/v1/residents/", {
      headers,
      data: { first_name: "Sam", last_name: last, street_id: streetId },
    })

    const name = `ZZ Sector ${randomLetters(6)}`
    const renamed = `${name} X`

    await page.goto("/issuances")
    await page.getByRole("button", { name: "Issuance settings" }).click()
    const dialog = page.getByTestId("issuance-settings")
    await dialog.getByTestId("settings-tab-sector").click()
    await dialog.getByLabel("New sector name").fill(name)
    await dialog.getByRole("button", { name: "Add" }).click()
    await expect(dialog.getByText(name, { exact: true })).toBeVisible()

    await dialog.getByRole("button", { name: `Rename ${name}` }).click()
    await dialog.getByRole("textbox").last().fill(renamed)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog.getByText(renamed, { exact: true })).toBeVisible()
    await page.keyboard.press("Escape")

    // The Indigency form lists the renamed sector.
    await page.getByRole("button", { name: "New Issuance" }).click()
    const form = page.getByRole("dialog").last()
    await form.getByRole("combobox", { name: /resident/i }).fill(last)
    await page.getByRole("option").first().click()
    await form
      .locator("label:has(input[type=radio])")
      .filter({ hasText: /Indigency/ })
      .first()
      .click()
    // Sectors are checkbox buttons on the Indigency form; the renamed one is listed.
    await expect(form.getByRole("checkbox", { name: renamed })).toBeVisible()

    // Start again (the form is unsaved), then delete the sector.
    await page.goto("/issuances")
    await page.getByRole("button", { name: "Issuance settings" }).click()
    const settings = page.getByTestId("issuance-settings")
    await settings.getByTestId("settings-tab-sector").click()
    await settings.getByRole("button", { name: `Delete ${renamed}` }).click()
    await page
      .getByRole("dialog")
      .filter({ hasText: "Delete sector?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click()
    await expect(settings.getByText(renamed, { exact: true })).toHaveCount(0)
  })
})
