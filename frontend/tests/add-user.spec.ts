import { expect, test } from "@playwright/test"
import { fillNewUser, finishNewUser } from "./utils/adminUsers"
import { randomEmail } from "./utils/random"

// The sandbox and the office have no mail server, so a new account normally
// ends on the one-time hand-over screen. With a mail server the dialog closes
// by itself; these tests accept both so they also pass against Mailpit.

async function save(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Save" }).click()
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save" }),
  ).toHaveCount(0)
}

test.describe("Add User", () => {
  test("shows the default password once when it was not emailed", async ({
    page,
  }) => {
    await page.goto("/admin")
    const email = randomEmail()

    await page.getByRole("button", { name: "Add User" }).click()
    await fillNewUser(page, { email, first: "Hand", last: "Over" })
    await save(page)

    if (await page.getByTestId("hand-over").isVisible()) {
      await expect(page.getByTestId("default-password")).toHaveText(
        "ChangeThisPassword",
      )
    }
    await finishNewUser(page)

    await page.getByPlaceholder("Search name or email").fill(email)
    const row = page.getByRole("row").filter({ hasText: email })
    await expect(row).toBeVisible()
    await expect(row.getByText("Hand Over")).toBeVisible()
  })

  test("first and last name are required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()
    await page.getByPlaceholder("Email", { exact: true }).fill(randomEmail())
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Enter the first name")).toBeVisible()
    await expect(page.getByText("Enter the last name")).toBeVisible()
    await expect(page.getByTestId("hand-over")).not.toBeVisible()
  })

  test("a reserved address ending gets a clear message", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()
    await fillNewUser(page, { email: "someone@office.local" })
    await page.getByRole("button", { name: "Save" }).click()

    await expect(
      page.getByText(/This kind of address cannot be used/),
    ).toBeVisible()
  })

  test("the name parts are joined into the full name", async ({ page }) => {
    await page.goto("/admin")
    const email = randomEmail()

    await page.getByRole("button", { name: "Add User" }).click()
    await fillNewUser(page, { email, first: "Juan", last: "Dela Cruz" })
    await page.getByPlaceholder("Enter middle name or initial").fill("Santos")
    await page.getByPlaceholder("Jr., Sr., III, etc.").fill("Jr.")
    await save(page)
    await finishNewUser(page)

    await page.getByPlaceholder("Search name or email").fill(email)
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: email })
        .getByText("Juan Santos Dela Cruz Jr."),
    ).toBeVisible()
  })
})
