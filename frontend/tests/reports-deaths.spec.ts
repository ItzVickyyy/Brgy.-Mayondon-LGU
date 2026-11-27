// Patch 329: Management Reports has a "Deaths" report (counts only: evidence, sex, age group, purok,
// and the deaths with no usable date). Mocked API, needs only the frontend.
import { readFileSync } from "node:fs"
import { expect, type Page, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const period = {
  period: "quarter",
  start: "2026-10-01",
  end: "2026-11-27",
  previous_start: "2026-07-01",
  previous_end: "2026-09-30",
}

const report = {
  period,
  total: 7,
  verified: 4,
  reported: 3,
  by_sex: { male: 3, female: 3, not_recorded: 1 },
  by_age: [
    { bracket: "0-17", count: 0 },
    { bracket: "18-29", count: 1 },
    { bracket: "30-49", count: 1 },
    { bracket: "50-64", count: 2 },
    { bracket: "65+", count: 2 },
    { bracket: "unknown", count: 1 },
  ],
  by_purok: [
    { purok: 2, count: 3 },
    { purok: 5, count: 3 },
  ],
  purok_not_recorded: 1,
  date_unknown: 2,
  date_too_general: 1,
}

const empty = {
  ...report,
  total: 0,
  verified: 0,
  reported: 0,
  by_sex: { male: 0, female: 0, not_recorded: 0 },
  by_age: report.by_age.map((row) => ({ ...row, count: 0 })),
  by_purok: [],
  purok_not_recorded: 0,
  date_unknown: 0,
  date_too_general: 0,
}

// Position of "Deaths" in the "Report type" list.
const DEATHS = 6

async function open(
  page: Page,
  language: "en" | "fil",
  body: unknown = report,
  seen: string[] = [],
) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (value: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      })
    const url = route.request().url()
    if (url.includes("/users/me/preferences")) return json(null)
    if (url.includes("/users/me")) return json(admin)
    if (url.includes("/reports/deaths")) {
      seen.push(new URL(url).search)
      return json(body)
    }
    if (url.includes("/reports/exported"))
      return route.fulfill({ status: 204, body: "" })
    if (url.includes("/reports/summary"))
      return json({
        period,
        documents_issued: 0,
        records_expiring: 0,
        imports_committed: 0,
      })
    if (url.includes("/lookups/")) return json([])
    return json({ data: [], count: 0 })
  })
  await page.addInitScript((value) => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", value)
    localStorage.setItem("vite-ui-theme", "light")
  }, language)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/reports")
  await chooseOption(page.locator('[aria-haspopup="listbox"]').first(), DEATHS)
}

for (const language of ["en", "fil"] as const) {
  test(`the Deaths report shows each count, with no names (${language})`, async ({
    page,
  }) => {
    const seen: string[] = []
    await open(page, language, report, seen)
    const rows = page.locator("tbody tr")
    // total + 2 evidence + 3 sex + 6 age + 2 purok + purok not recorded + 2 dates
    await expect(rows).toHaveCount(17)
    await expect(rows.nth(0)).toContainText("7")
    await expect(rows.nth(1)).toContainText("4")
    await expect(rows.nth(2)).toContainText("3")
    // Age groups (rows 6 to 10), then the deaths whose age is not known.
    await expect(rows.nth(10)).toContainText("65+")
    await expect(rows.nth(10).locator("td").last()).toHaveText("2")
    await expect(rows.nth(11).locator("td").last()).toHaveText("1")
    // Only puroks that have a death are listed, then the ones with no purok.
    await expect(rows.nth(12)).toContainText("2")
    await expect(rows.nth(13)).toContainText("5")
    await expect(rows.nth(14).locator("td").last()).toHaveText("1")
    // Deaths with no date, and with a date too general for the period.
    await expect(rows.nth(15).locator("td").last()).toHaveText("2")
    await expect(rows.nth(16).locator("td").last()).toHaveText("1")
    await expect(page.getByText("0-17")).toBeVisible()
    // The period select is sent to the server.
    expect(seen.some((query) => query.includes("period=month"))).toBe(true)
    await expect(
      page.getByRole("button", { name: /Retry|Subukan/ }),
    ).toHaveCount(0)
  })
}

test("the Deaths report says so when there is nothing to count", async ({
  page,
}) => {
  await open(page, "en", empty)
  await expect(page.getByText("No deaths in this period")).toBeVisible()
  await expect(page.locator("tbody tr").first()).toContainText("0")
})

test("a period with only undated deaths is still a table, not an empty state", async ({
  page,
}) => {
  await open(page, "en", { ...empty, date_unknown: 2 })
  await expect(page.getByText("No deaths in this period")).toHaveCount(0)
  await expect(page.locator("tbody tr").last()).toBeVisible()
})

test("the saved CSV is English, whatever the interface language", async ({
  page,
}) => {
  await open(page, "fil")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "I-export", exact: true }).click()
  await page.getByTestId("export-format-csv").click()
  const csv = readFileSync(await (await downloadPromise).path(), "utf8")
  const lines = csv.split("\r\n")
  expect(lines[0]).toBe('"Breakdown","Group","Deaths"')
  expect(lines[1]).toBe('"All deaths","Deaths in this period","7"')
  expect(csv).toContain('"Evidence","Verified (document seen)","4"')
  expect(csv).toContain('"Age at death","65+","2"')
  expect(csv).toContain('"Age at death","Age not known","1"')
  expect(csv).toContain('"Purok","Purok 5","3"')
  expect(csv).toContain(
    '"Date of death","No date of death (not counted in any period)","2"',
  )
  // Counts only: nothing in the file is a person.
  expect(csv).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+ (Cruz|Santos|Reyes)/)
})
