import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

test("Public landing page shows barangay information and staff login", async ({
  page,
}) => {
  await page.goto("/welcome")

  await expect(
    page.getByRole("heading", { name: "Barangay Mayondon LGU" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Resident Records" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Document Preparation" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Issuance History" }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Staff Login" }).first(),
  ).toHaveAttribute("href", "/login")
})

test("Unauthenticated visitors to the dashboard reach public information", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveURL(/welcome$/)
})
