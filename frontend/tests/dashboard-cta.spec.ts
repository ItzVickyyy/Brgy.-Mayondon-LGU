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
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox()
  const subtitle = page.locator("h1 + p")
  const subtitleBox = await subtitle.boundingBox()
  // The button fits inside the title block's height, so nothing moves.
  const titleHeight =
    (subtitleBox?.y ?? 0) + (subtitleBox?.height ?? 0) - (heading?.y ?? 0)
  expect(box?.height).toBeLessThanOrEqual(titleHeight)

  await expect(page.getByText("Counts active resident records")).toHaveCount(0)
})
