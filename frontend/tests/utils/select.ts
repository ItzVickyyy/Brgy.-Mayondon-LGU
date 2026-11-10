import type { Locator } from "@playwright/test"

/**
 * Picks a choice in the app's custom dropdown (a button with aria-haspopup="listbox").
 * Use the visible text of the choice, or its position in the list (from 0)
 * when the text depends on the language.
 */
export async function chooseOption(
  trigger: Locator,
  choice: string | RegExp | number,
) {
  await trigger.click()
  const options = trigger.page().getByRole("option")
  const option =
    typeof choice === "number"
      ? options.nth(choice)
      : trigger.page().getByRole("option", {
          name: choice,
          exact: typeof choice === "string",
        })
  await option.click()
}
