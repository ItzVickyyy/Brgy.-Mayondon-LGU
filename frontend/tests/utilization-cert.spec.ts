// Profile menu > Utilization Cert. (patch 245): the monthly Certificate of Utilization. The API is
// mocked (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const staff = {
  id: "22222222-0000-0000-0000-000000000002",
  email: "staff@example.com",
  is_active: true,
  is_superuser: false,
  role: "staff",
  full_name: "Test Staff",
}

async function signedIn(page: Page, punong: string | null) {
  // The month list starts from today, so pin the clock (Philippine time).
  await page.clock.setFixedTime(new Date("2026-11-24T10:00:00+08:00"))
  const printed: string[] = []
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/users/me")) return json(staff)
    if (url.pathname.endsWith("/utilization/printed")) {
      printed.push(route.request().postData() ?? "")
      return route.fulfill({ status: 204 })
    }
    if (url.pathname.endsWith("/utilization/")) {
      const month = url.searchParams.get("month") ?? "2026-11"
      return json({
        month,
        month_start: `${month}-01`,
        month_end: `${month}-28`,
        clients_served: month === "2026-11" ? 6 : 1234,
        documents_issued: 9,
        punong_barangay: punong,
      })
    }
    if (url.pathname.includes("/lookups/")) return json([])
    if (url.pathname.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
  // Printing is a browser dialog: count the calls instead of opening it. Like Chrome, fire
  // "afterprint" straight away: the sheet must not depend on any state that event could end.
  await page.addInitScript(() => {
    const w = window as unknown as { __prints: number }
    w.__prints = 0
    window.print = () => {
      w.__prints += 1
      window.dispatchEvent(new Event("afterprint"))
    }
  })
  return printed
}

async function openDialog(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /user menu/i }).click()
  await page.getByRole("menuitem", { name: "Utilization Cert." }).click()
  const dialog = page.getByTestId("utilization-dialog")
  await expect(dialog).toBeVisible()
  return dialog
}

test("the button sits under Learn more and opens the explanation", async ({
  page,
}) => {
  await signedIn(page, "Danilo V. Apolinario")
  await page.goto("/")
  await page.getByRole("button", { name: /user menu/i }).click()
  const items = await page.getByRole("menuitem").allTextContents()
  const learn = items.findIndex((text) => text.includes("Learn more"))
  expect(items[learn + 1]).toContain("Utilization Cert.")
  await page.getByRole("menuitem", { name: "Utilization Cert." }).click()
  const dialog = page.getByTestId("utilization-dialog")
  await expect(
    dialog.getByRole("heading", { name: "What this is for" }),
  ).toBeVisible()
  await expect(dialog.getByTestId("utilization-clients")).toHaveText("6")
  await expect(dialog).toContainText("Danilo V. Apolinario")
  await expect(dialog.getByTestId("utilization-print")).toBeEnabled()
})

test("Print fills the certificate, records the print and opens the dialog", async ({
  page,
}) => {
  const printed = await signedIn(page, "Danilo V. Apolinario")
  const dialog = await openDialog(page)
  await dialog.getByTestId("utilization-print").click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __prints: number }).__prints),
    )
    .toBe(1)
  expect(printed).toHaveLength(1)
  // Chrome draws its preview after print() returns: the print-only sheet must still be in the page,
  // and in print media nothing else may show.
  await page.waitForTimeout(1500)
  await page.emulateMedia({ media: "print" })
  await expect(page.getByTestId("utilization-sheet")).toBeVisible()
  await expect(page.getByTestId("utilization-dialog")).toBeHidden()
  await page.emulateMedia({ media: "screen" })
  expect(JSON.parse(printed[0] as string)).toEqual({ month: "2026-11" })
  const sheet = page.getByTestId("utilization-sheet")
  await expect(sheet).toContainText("CERTIFICATE OF UTILIZATION")
  await expect(sheet).toContainText("For the Month of November 2026")
  await expect(sheet.getByTestId("utilization-sheet-clients")).toContainText(
    "as of November : 6",
  )
  await expect(sheet).toContainText("HON. DANILO V. APOLINARIO")
  // The date of issue is left for the office to write.
  await expect(sheet).toContainText("Issued this ______ day of")
})

test("another month changes the figures; no official prints a blank name", async ({
  page,
}) => {
  await signedIn(page, null)
  const dialog = await openDialog(page)
  await expect(dialog).toContainText("Not set in Officials")
  await expect(dialog).toContainText("will print blank")
  await dialog.getByTestId("utilization-month").click()
  await page.getByRole("option").nth(1).click()
  await expect(dialog.getByTestId("utilization-clients")).toHaveText("1,234")
})

test("the certificate is hidden on screen", async ({ page }) => {
  await signedIn(page, "Danilo V. Apolinario")
  await openDialog(page)
  await expect(page.getByTestId("utilization-sheet")).toBeHidden()
})
