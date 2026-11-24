// The information popups (patch 207): Get help, Learn more, Version, Dev Note, Terms of Use and
// Privacy Policy share one layout, have no draft / prototype wording, and the long pages have a
// contents bar. The API is mocked (synthetic data), so this spec needs only the running frontend.
import { expect, type Page, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}

const forbidden =
  /prototype|pending barangay review|not yet approved|to be confirmed|draft, pending/i

async function signedIn(page: Page, user: object = admin) {
  await page.route("**/api/v1/**", async (route) => {
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/users/me")) return json(user)
    if (path.includes("/lookups/")) return json([])
    if (path.includes("/dashboard"))
      return json({ total_issued: 0, by_document_type: [] })
    return json({ data: [], count: 0 })
  })
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test-token")
    localStorage.setItem("app-language", "en")
    localStorage.setItem("vite-ui-theme", "light")
  })
}

test.describe("popups on the login page", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const [button, title] of [
    ["Version", "Version"],
    ["Dev Note", "Dev Note"],
    ["Terms of Use", "Terms of Use"],
    ["Privacy Policy", "Privacy Policy"],
  ] as const) {
    test(`${title} has a header, a Close button and no draft or prototype wording`, async ({
      page,
    }) => {
      await page.goto("/login")
      await page.getByRole("button", { name: button, exact: true }).click()
      const dialog = page.getByRole("dialog", { name: title })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByTestId("info-close")).toBeVisible()
      await expect(dialog).not.toContainText(forbidden)
      await dialog.getByTestId("info-close").click()
      await expect(dialog).toBeHidden()
    })
  }

  for (const width of [390, 700, 900, 1024]) {
    test(`a wide popup keeps a side margin at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto("/login")
      await page
        .getByRole("button", { name: "Terms of Use", exact: true })
        .click()
      const dialog = page.getByRole("dialog", { name: "Terms of Use" })
      await expect(dialog).toBeVisible()
      // The open animation scales the box, so wait until it has settled.
      await expect
        .poll(async () => (await dialog.boundingBox())?.x ?? -1)
        .toBeGreaterThanOrEqual(15)
    })
  }

  test("Terms of Use has 14 numbered sections and the contents bar jumps to one", async ({
    page,
  }) => {
    await page.goto("/login")
    await page
      .getByRole("button", { name: "Terms of Use", exact: true })
      .click()
    const dialog = page.getByRole("dialog", { name: "Terms of Use" })
    const contents = dialog.getByRole("navigation", { name: "Sections" })
    await expect(contents.getByRole("button")).toHaveCount(14)
    await contents.getByRole("button", { name: /^14\. Questions/ }).click()
    await expect(
      dialog.getByRole("heading", { name: /Questions/ }),
    ).toBeInViewport()
  })

  test("Privacy Policy keeps the sections of the barangay's text", async ({
    page,
  }) => {
    await page.goto("/login")
    await page
      .getByRole("button", { name: "Privacy Policy", exact: true })
      .click()
    const dialog = page.getByRole("dialog", { name: "Privacy Policy" })
    for (const heading of [
      "About this policy",
      "What information is kept",
      "Who can see it",
      "How it is protected",
      "Your rights",
      "Residents' photos",
    ]) {
      await expect(dialog.getByRole("heading", { name: heading })).toHaveCount(
        1,
      )
    }
    await expect(dialog).toContainText("Republic Act No. 10173")
  })

  test("the popup fits a phone: the header and Close stay on screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 780 })
    await page.goto("/login")
    await page
      .getByRole("button", { name: "Privacy Policy", exact: true })
      .click()
    const dialog = page.getByRole("dialog", { name: "Privacy Policy" })
    await expect(dialog.getByTestId("info-close")).toBeInViewport()
    const box = await dialog.boundingBox()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(390)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
  })
})

test.describe("popups in the profile menu", () => {
  test("Get help has no draft wording and ends with the developers' contact guide", async ({
    page,
  }) => {
    await signedIn(page)
    await page.goto("/")
    await page.getByRole("button", { name: /user menu/i }).click()
    await page.getByRole("menuitem", { name: "Get help" }).click()
    const dialog = page.getByRole("dialog", { name: "Get help" })
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toContainText(forbidden)
    await dialog.getByText("Contact the developers", { exact: true }).click()
    await expect(
      dialog.getByText("What to include in your message"),
    ).toBeVisible()
    await expect(dialog.getByText("Urgent problems")).toBeVisible()
    await expect(dialog.getByText("github.com/ItzVickyyy")).toBeVisible()
    // The email, phone and hours were never confirmed, so nothing is shown for them.
    await expect(dialog).not.toContainText("Hours")
  })

  test("Learn more covers roles and protection and has no status line", async ({
    page,
  }) => {
    await signedIn(page)
    await page.goto("/")
    await page.getByRole("button", { name: /user menu/i }).click()
    await page.getByRole("menuitem", { name: "Learn more" }).click()
    const dialog = page.getByRole("dialog", { name: "About this system" })
    await expect(dialog.getByText("Who can use it")).toBeVisible()
    await expect(dialog.getByText("Your records are protected")).toBeVisible()
    await expect(dialog).not.toContainText(forbidden)
  })

  async function openHelp(page: Page) {
    await page.goto("/")
    await page.getByRole("button", { name: /user menu/i }).click()
    await page.getByRole("menuitem", { name: "Get help" }).click()
    const dialog = page.getByRole("dialog", { name: "Get help" })
    await expect(dialog).toBeVisible()
    return dialog
  }

  test("the Get help search shows only matching topics and clearing it restores the list", async ({
    page,
  }) => {
    await signedIn(page)
    const dialog = await openHelp(page)
    const box = dialog.getByTestId("help-search")
    await box.fill("save anyway")
    await expect(dialog.getByTestId("help-search-count")).toContainText("topic")
    await expect(
      dialog.getByText(
        "The system says this resident may already be on record.",
      ),
    ).toBeVisible()
    await expect(dialog.getByText("Signing out", { exact: true })).toBeHidden()
    await expect(
      dialog.getByText("Getting started", { exact: true }),
    ).toBeHidden()

    await box.fill("")
    await expect(
      dialog.getByText("Getting started", { exact: true }),
    ).toBeVisible()
    await expect(dialog.getByText("Signing out", { exact: true })).toBeVisible()
    await expect(dialog.getByTestId("help-search-count")).toHaveText("")

    await box.fill("zzzz nothing")
    await expect(dialog.getByTestId("help-search-count")).toContainText(
      "Nothing matches",
    )
  })

  test("the backup-file problem is shown to administrators only", async ({
    page,
  }) => {
    await signedIn(page)
    let dialog = await openHelp(page)
    await dialog
      .getByTestId("help-search")
      .fill("no longer in the backup folder")
    await expect(dialog.getByTestId("help-search-count")).toContainText(
      "1 topic",
    )
    await page.keyboard.press("Escape")

    await page.unroute("**/api/v1/**")
    await signedIn(page, {
      ...admin,
      is_superuser: false,
      role: "staff",
      full_name: "Test Staff",
    })
    await page.reload()
    dialog = await openHelp(page)
    await dialog
      .getByTestId("help-search")
      .fill("no longer in the backup folder")
    await expect(dialog.getByTestId("help-search-count")).toContainText(
      "Nothing matches",
    )
  })
})
