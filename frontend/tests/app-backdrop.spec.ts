// Page backdrop (patch 137): quiet solid shapes behind the content. They must be
// decorative only: hidden from assistive technology, never catching clicks, and
// free of gradients.

import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { logInUser } from "./utils/user"

test.use({ storageState: { cookies: [], origins: [] } })

test("the backdrop is decorative, solid-colour and does not block the page", async ({
  page,
}) => {
  await logInUser(page, firstSuperuser, firstSuperuserPassword)
  const backdrop = page.getByTestId("app-backdrop")
  await expect(backdrop).toHaveAttribute("aria-hidden", "true")
  await expect(backdrop).toHaveCSS("pointer-events", "none")

  // No element of the backdrop draws a gradient (the dot grid is an image tile).
  const gradients = await backdrop.evaluate(
    (el) =>
      [el, ...el.querySelectorAll("*")].filter((node) =>
        getComputedStyle(node).backgroundImage.includes("gradient"),
      ).length,
  )
  expect(gradients).toBe(0)

  // It sits behind the content: the page heading stays the topmost element.
  const heading = page.getByRole("heading", { name: "Dashboard" })
  const onTop = await heading.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    )
    return hit === el || el.contains(hit)
  })
  expect(onTop).toBe(true)
})
