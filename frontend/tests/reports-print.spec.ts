// A printed Management Report that runs over several pages: the table header
// repeats, the totals row prints once (a <tfoot> would repeat on every page),
// the report sets its own page size and margins for that print only, and the
// app's page colour does not paint under the report. The API is mocked, so
// this spec needs only the running frontend.
import { expect, test } from "@playwright/test"

const rows = Array.from({ length: 120 }, (_, i) => ({
  kind: i % 2 ? "clearance" : "barangay_id",
  issuance_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  reference_no: `BC-2026-${String(i + 1).padStart(5, "0")}`,
  resident_id: `11111111-0000-0000-0000-${String(i).padStart(12, "0")}`,
  resident_name: `Resident ${i + 1}, Sample`,
  expires_on: "2026-12-31",
  days_left: 42 - i,
  status: i % 3 ? "expiring_soon" : "expired",
}))

test("a long printed report repeats its header, prints the total once and sets its page", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url()
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    if (url.includes("/users/me"))
      return json({
        id: "22222222-0000-0000-0000-000000000001",
        email: "admin@example.com",
        is_active: true,
        is_superuser: true,
        role: "admin",
        full_name: "Test Admin",
      })
    if (url.includes("/reports/expiring"))
      return json({ data: rows, count: rows.length })
    if (url.includes("/reports/summary"))
      return json({
        period: {
          period: "this_month",
          start: "2026-11-01",
          end: "2026-11-30",
          previous_start: null,
          previous_end: null,
        },
        documents_issued: 5,
        records_expiring: rows.length,
        imports_committed: 1,
      })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    // The dialog is not shown in a test; "afterprint" is sent by hand below.
    window.print = () => {}
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })

  await page.goto("/reports")
  await page.locator('[aria-haspopup="listbox"]').first().click()
  await page.getByRole("option").nth(2).click()
  await page.getByRole("button", { name: /^print/i }).click()

  // Every row is on the page while printing, not only the first screen.
  await expect(page.locator("body.report-printing")).toHaveCount(1)
  await expect(page.getByText("Resident 120, Sample")).toBeVisible()
  expect(
    await page
      .locator("style[data-report-page]")
      .evaluate((el) => el.textContent),
  ).toContain("size: 8.5in 11in; margin: 0.6in")

  await page.emulateMedia({ media: "print" })
  const display = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).display)
  expect(await display(".report-sheet thead")).toBe("table-header-group")
  expect(await display(".report-sheet tfoot")).toBe("table-row-group")
  for (const selector of [
    "body",
    '[data-slot="sidebar-wrapper"]',
    "#main-content",
  ]) {
    expect(
      await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(255, 255, 255)")
  }
  expect(
    await page
      .locator(".report-sheet td.font-mono")
      .first()
      .evaluate((el) => getComputedStyle(el).whiteSpace),
  ).toBe("nowrap")

  // When the print ends the page rule and the print mode are removed again.
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  await expect(page.locator("style[data-report-page]")).toHaveCount(0)
  await expect(page.locator("body.report-printing")).toHaveCount(0)
})
