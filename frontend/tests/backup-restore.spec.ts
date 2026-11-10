// Backup and Restore page against the real backend (System Administrator).
// Skipped when the backend cannot make backups (pg_dump or the folder missing).
import { expect, test } from "@playwright/test"
import { chooseOption } from "./utils/select"

test("make a backup, check it, and get the restore command", async ({
  page,
}) => {
  await page.goto("/backup-restore")
  await expect(
    page.getByRole("heading", { name: "Backup and Restore", exact: true }),
  ).toBeVisible()

  const backUp = page.getByRole("button", { name: "Back up now" })
  await expect(backUp).toBeVisible()
  test.skip(await backUp.isDisabled(), "backups are not set up on this server")

  await backUp.click()
  await expect(page.getByText(/was created and checked/)).toBeVisible()
  const row = page.getByRole("row", { name: /mayondon-db-/ }).first()
  await expect(row.getByText("Verified")).toBeVisible()

  // Verify again from the row menu.
  await row.getByRole("button", { name: /more/i }).click()
  await page.getByRole("menuitem", { name: "Verify file" }).click()
  await expect(page.getByText(/was checked and is readable/)).toBeVisible()

  // Download the file from the row menu.
  await row.getByRole("button", { name: /more/i }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: "Download copy" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mayondon-db-.*\.dump$/)
  await expect(page.getByText(/Download of .* started/)).toBeVisible()

  // Restore: choose the backup, type the word, get the command (nothing is restored).
  const archive = page.getByLabel("Backup archive")
  await chooseOption(archive, 1)
  await page.getByRole("button", { name: "Prepare Restore" }).click()
  const confirm = page.getByRole("button", { name: "Check and Show Command" })
  await expect(confirm).toBeDisabled()
  await page.getByPlaceholder("RESTORE").fill("RESTORE")
  await confirm.click()
  await expect(page.getByText("Ready to restore")).toBeVisible()
  await expect(page.getByText(/restore-db\.ps1 -BackupFile/)).toBeVisible()
})

test("Filipino page shows the backup controls", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("app-language", "fil"))
  await page.goto("/backup-restore")
  await expect(
    page.getByRole("button", { name: "Mag-backup ngayon" }),
  ).toBeVisible()
})
