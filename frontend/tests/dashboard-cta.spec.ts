import { expect, test } from "@playwright/test"

// The header "Issue Document" button is the call to action: bigger than the
// default 44 px button, without growing the header row around it.
test("Issue Document is a prominent button and the population note is gone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const button = page.getByRole("button", { name: "Issue Document" })
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(48)
  // The page title has no sub-label under it (patch 282).
  await expect(page.locator("h1 + p")).toHaveCount(0)

  await expect(page.getByText("Counts active resident records")).toHaveCount(0)
})
