// The Add button in an Issuance settings list is never disabled for an empty
// name: clicking it explains what is missing. The API is mocked, so this spec
// needs only the running frontend (run with --no-deps).
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const message = {
  en: "Enter a name before adding it to the list.",
  fil: "Maglagay ng pangalan bago idagdag sa listahan.",
}

for (const language of ["en", "fil"] as const) {
  test(`Add is clickable with an empty name (${language})`, async ({
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
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/issuances")
    await page
      .getByRole("button", { name: /Issuance settings|Mga setting ng isyu/ })
      .click()

    const dialog = page.getByTestId("issuance-settings")
    await dialog.getByTestId("settings-tab-street").click()
    const add = dialog.locator("form button[type=submit]")
    await expect(add).toBeEnabled()
    await add.click()
    await expect(dialog.getByRole("alert")).toHaveText(message[language])
    await expect(dialog.locator("#street-new-name")).toBeFocused()

    // Typing clears the message.
    await dialog.locator("#street-new-name").fill("Mabini")
    await expect(dialog.getByRole("alert")).toHaveCount(0)
  })
}
