// Login page "About this system" button, the footer order (Version, Dev Note, Terms of Use,
// Privacy Policy), the Dev Note story and the Version popup (patch 204). Nothing here needs the
// backend: the login page and its popups are static, so run with --no-deps.
import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

test("the footer lists Version, Dev Note, Terms of Use, Privacy Policy in that order", async ({
  page,
}) => {
  await page.goto("/login")
  const links = page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("button")
  await expect(links).toHaveText([
    "Version",
    "Dev Note",
    "Terms of Use",
    "Privacy Policy",
  ])
})

test("the About button opens the page about the system and it closes again", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByTestId("about-button").filter({ visible: true }).click()
  const dialog = page.getByRole("dialog", { name: "About this system" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("What it is")).toBeVisible()
  await expect(dialog.getByText("Where the data lives")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
})

test("the Dev Note tells the story and names the team and the people who guided it", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Dev Note" }).click()
  const dialog = page.getByRole("dialog", { name: "Dev Note" })
  await expect(dialog.getByText("How it started")).toBeVisible()
  for (const name of [
    "Vic John O. Salen Jr.",
    "Justin Adrian P. Reboton",
    "Jean Mervin G. Fajardo",
    "Prof. Merardo Arenas Camba, Jr.",
    "Sir Mike Philip Ramos",
    "Sir Alejandro V. Matute Jr.",
  ]) {
    await expect(dialog.getByText(name, { exact: true })).toBeVisible()
  }
})

test("the Version popup shows the version, the release and the build day", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Version", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Version" })
  await expect(dialog.getByText("Release", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Built on", { exact: true })).toBeVisible()
  // In a clone the commit comes from Git; an installed copy gets it from the archive. Either way
  // it is a short hash, never the raw "$Format" marker.
  const commit = dialog.getByTestId("version-commit")
  if (await commit.count()) {
    await expect(commit).toHaveText(/^[0-9a-f]{7,40}$/)
  } else {
    await expect(dialog.getByText("Development copy")).toBeVisible()
  }
  await expect(dialog).not.toContainText("$Format")
})

test("Filipino labels appear in the footer and on the About button", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("app-language", "fil"))
  await page.goto("/login")
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Tala ng mga Developer" }),
  ).toBeVisible()
  await expect(
    page.getByTestId("about-button").filter({ visible: true }),
  ).toContainText("Tungkol sa sistemang ito")
})
