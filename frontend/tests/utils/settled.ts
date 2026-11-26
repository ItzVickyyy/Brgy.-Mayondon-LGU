import { expect, type Locator } from "@playwright/test"

// A pop-up scales in when it opens, so measuring it too early gives sizes
// and positions that are a few pixels off. Wait until its box has stayed
// the same for three reads in a row (about 150 ms) before measuring.
export async function waitUntilSettled(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  let previous = ""
  let same = 0
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox()
        const now = box
          ? [box.x, box.y, box.width, box.height].map(Math.round).join(",")
          : ""
        same = now !== "" && now === previous ? same + 1 : 0
        previous = now
        return same
      },
      { intervals: [50] },
    )
    .toBeGreaterThanOrEqual(3)
}
