// Issuance Management with nothing issued yet: the "Latest issuance" card says
// "None yet" (it used to show "—" and "Could not load summary data", because
// the query returned undefined, which React Query treats as an error). The API
// is mocked, so this spec needs only the running frontend.
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const cases = [
  {
    language: "en",
    label: "Latest issuance",
    none: "None yet",
    error: "Could not load summary data",
  },
  {
    language: "fil",
    label: "Pinakahuling isyu",
    none: "Wala pa",
    error: "Hindi ma-load ang datos ng buod",
  },
]

for (const { language, label, none, error } of cases) {
  test(`latest issuance card says "${none}" when nothing is issued (${language})`, async ({
    page,
  }) => {
    await page.route("**/api/v1/**", async (route) => {
      const json = (body: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        })
      const url = route.request().url()
      if (url.includes("/users/me")) return json(admin)
      if (url.includes("/lookups/")) return json([])
      if (url.includes("/dashboard"))
        return json({ total_issued: 0, by_document_type: [] })
      return json({ data: [], count: 0 })
    })
    await page.addInitScript((lang) => {
      localStorage.setItem("access_token", "test-token")
      localStorage.setItem("app-language", lang)
      localStorage.setItem("vite-ui-theme", "light")
    }, language)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/issuances")

    await expect(page.getByText(label, { exact: true })).toBeVisible()
    await expect(page.getByText(none, { exact: true })).toBeVisible()
    await expect(page.getByText(error)).toHaveCount(0)
  })
}
