// Saving a resident with nothing changed writes no Activity Log row and says so;
// changing one field logs only that field. Needs the running app.
import { expect, test } from "@playwright/test"
import { letterTag } from "./utils/random"

test("saving Edit resident details with no change is not logged", async ({
  page,
}) => {
  await page.goto("/records")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const lastName = letterTag("NoChange")
  const created = await (
    await page.request.post("/api/v1/residents/?confirm_duplicate=true", {
      headers,
      data: {
        first_name: "Edit",
        last_name: lastName,
        birthdate: "1990-01-01",
        sex: "Male",
        civil_status: "Single",
        house_number: "9",
      },
    })
  ).json()
  const auditRows = async () => {
    const response = await page.request.get("/api/v1/activity/?limit=100", {
      headers,
    })
    const body = await response.json()
    return body.data
      .filter(
        (row: { record_id: string; action: string }) =>
          row.record_id === created.id && row.action === "resident.update",
      )
      .map((row: { details: unknown }) => row.details)
  }

  await page
    .getByPlaceholder(/search/i)
    .first()
    .fill(lastName)
  const row = page.getByRole("row", { name: new RegExp(lastName) })
  await expect(row).toHaveCount(1)
  await row.getByRole("button", { name: "Profile", exact: true }).click()
  await page.getByRole("button", { name: "Edit details", exact: true }).click()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText(/No changes to/)).toBeVisible()
  expect(await auditRows()).toEqual([])

  await page.getByRole("button", { name: "Edit details", exact: true }).click()
  await expect(page.getByLabel(/House/i).first()).toHaveValue("9")
  await page.getByLabel(/House/i).first().fill("10")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText(/ updated$/)).toBeVisible()
  expect(await auditRows()).toEqual([{ fields: ["house_number"] }])
})
