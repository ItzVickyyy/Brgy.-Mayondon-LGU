import { expect, type Page } from "@playwright/test"

/** Fill the Add User dialog. Names default to a fictional person. */
export async function fillNewUser(
  page: Page,
  {
    email,
    first = "Test",
    last = "Person",
  }: { email: string; first?: string; last?: string },
) {
  await page.getByPlaceholder("Email", { exact: true }).fill(email)
  await page.getByPlaceholder("Enter first name").fill(first)
  await page.getByPlaceholder("Enter last name").fill(last)
}

/**
 * Save the Add User dialog and leave it closed. Without a mail server the
 * dialog stays open on the one-time default-password screen; with one it
 * closes by itself.
 */
export async function saveNewUser(page: Page) {
  const dialog = page.getByRole("dialog")
  await page.getByRole("button", { name: "Save" }).click()
  // The form is replaced by the hand-over screen or the dialog closes; wait
  // for the form's Save button to go before looking at which one happened.
  await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(0)
  await finishNewUser(page)
}

/** Dismiss the one-time hand-over screen if it is showing, then expect no dialog. */
export async function finishNewUser(page: Page) {
  const dialog = page.getByRole("dialog")
  if (await page.getByTestId("hand-over").isVisible()) {
    await page.getByRole("button", { name: "Done" }).click()
  }
  await expect(dialog).not.toBeVisible()
}
