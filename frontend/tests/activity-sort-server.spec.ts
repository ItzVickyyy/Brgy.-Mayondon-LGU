// Activity Log: a heading click asks the server to sort the whole log (314),
// instead of reordering the rows on the page. The API is mocked (synthetic
// data), so this spec needs only the running frontend. The mock answers a sort
// with a deliberately odd order: the page must show it as received.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const row = (n: number, email: string) => ({
  id: n,
  occurred_at: "2026-11-20T01:38:44.987923Z",
  actor_user_id: `33333333-0000-0000-0000-00000000000${n}`,
  actor_email: email,
  is_own: false,
  action: "resident.update",
  module: "records",
  record_type: "resident",
  record_id: `rec-${n}`,
  outcome: "success",
  reason: null,
  details: null,
})

// ES2020 has no Array.prototype.at.
const last = <T>(items: T[]) => items[items.length - 1]

const byDefault = [row(1, "b@example.test"), row(2, "c@example.test")]
const asServed = [row(3, "z@example.test"), row(4, "a@example.test")]

async function mockApi(page: Page, queries: URLSearchParams[]) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/users/me")) return json(admin)
    if (url.pathname.endsWith("/activity/options"))
      return json({ modules: [], actions: [], outcomes: [], actors: [] })
    if (url.pathname.endsWith("/activity/")) {
      queries.push(url.searchParams)
      const data = url.searchParams.has("sort_by") ? asServed : byDefault
      return json({ data, count: data.length })
    }
    if (url.pathname.includes("/lookups/")) return json([])
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test("Activity Log sorts on the server, cycling ascending, descending, default", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/activity-log")
  const emails = page.locator("table tbody tr td:nth-child(3)")
  await expect(emails).toHaveText(["b@example.test", "c@example.test"])
  expect(last(queries)?.has("sort_by")).toBe(false)

  const heading = page.getByTestId("sort-action")
  await heading.click()
  await expect(emails).toHaveText(["z@example.test", "a@example.test"])
  expect(last(queries)?.get("sort_by")).toBe("action")
  expect(last(queries)?.get("sort_dir")).toBe("asc")
  await expect(heading).toHaveAttribute("data-sort", "asc")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "desc")
  await expect.poll(() => last(queries)?.get("sort_dir")).toBe("desc")
  expect(last(queries)?.get("sort_by")).toBe("action")

  await heading.click()
  await expect(heading).toHaveAttribute("data-sort", "none")
  await expect(emails).toHaveText(["b@example.test", "c@example.test"])
  expect(last(queries)?.has("sort_by")).toBe(false)
})

test("Each Activity Log heading asks for its own server column", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockApi(page, queries)
  await page.goto("/activity-log")
  await expect(page.locator("table tbody tr")).toHaveCount(2)
  const columns = {
    dateTime: "occurred_at",
    user: "actor_email",
    module: "module",
    record: "record_id",
    outcome: "outcome",
  }
  for (const [heading, serverColumn] of Object.entries(columns)) {
    await page.getByTestId(`sort-${heading}`).click()
    await expect.poll(() => last(queries)?.get("sort_by")).toBe(serverColumn)
  }
})
