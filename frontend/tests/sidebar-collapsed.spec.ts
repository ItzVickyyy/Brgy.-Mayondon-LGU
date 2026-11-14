import { expect, test } from "@playwright/test"

import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { logInUser } from "./utils/user"

test.use({ storageState: { cookies: [], origins: [] } })

// In the collapsed sidebar every icon must show its name bubble on hover. The
// section labels are hidden there but used to sit over the icon above them and
// catch the mouse, so some bubbles never appeared.
test("every icon of the collapsed sidebar shows its name on hover", async ({
  page,
}) => {
  await logInUser(page, firstSuperuser, firstSuperuserPassword)
  await page.keyboard.press("Control+b")
  const buttons = page.locator('[data-sidebar="menu-button"]')
  await expect(buttons.first()).toBeVisible()
  const count = await buttons.count()
  expect(count).toBeGreaterThan(3)
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i)
    const name = (await button.innerText()).trim()
    await button.hover()
    await expect(
      page.locator('[data-slot="tooltip-content"]').filter({ hasText: name }),
    ).toBeVisible()
    await page.mouse.move(700, 400)
  }
})
