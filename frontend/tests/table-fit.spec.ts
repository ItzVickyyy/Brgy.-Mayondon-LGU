// The Records and Issuance History tables fit a 1280 px laptop screen without
// a sideways scroll bar, in English and in Filipino (whose labels are longer).
// Before, the Filipino tables were 42 to 152 px too wide, so the sticky Actions
// column slid over the last data column. The first residents row has a long
// Occupation to prove that column is cut short instead of widening, and the
// street names are long like the real ones (patch 274: with short mock streets
// this spec passed while real lists overran by 31 px in English and 72 px in
// Filipino). The Records table is also tried 16 px narrower, so a font that
// measures a little wider on another computer still fits. The API is mocked
// with real responses (synthetic residents), so this spec needs only the
// running frontend.
import { expect, test } from "@playwright/test"

const admin = {
  id: "22222222-0000-0000-0000-000000000001",
  email: "admin@example.com",
  is_active: true,
  is_superuser: true,
  role: "admin",
  full_name: "Test Admin",
}
const residents = {
  data: [
    {
      first_name: "Maria Cristina",
      middle_name: "Flores",
      last_name: "Dela Cruz-Villanueva",
      suffix: null,
      birthdate: "1937-08-02",
      birth_place: "Nagcarlan, Laguna",
      sex: "Female",
      civil_status: "Married",
      occupation: "Self-employed (sari-sari store owner)",
      house_number: "197",
      street_id: 3,
      purok: 7,
      resident_since_year: 1966,
      resident_since_birth: false,
      resident_type: null,
      id_number: null,
      voter_registration: "unregistered",
      residency_type: "new",
      emergency_contact_name: null,
      emergency_contact_address: null,
      emergency_contact_phone: null,
      id: "e7d083c5-29b4-402c-bc22-72c418d43c0f",
      full_name: "Maria Cristina Flores Dela Cruz-Villanueva",
      age: 89,
      sector_ids: [],
      has_photo: false,
      id_status: "none",
      id_valid_until: null,
      id_validity_months: 6,
      voter_proof_verified_at: null,
      voter_proof_verified_by_name: null,
      status: "active",
      archive_reason: null,
      archived_at: null,
      archived_by_name: null,
      created_at: "2026-11-20T01:38:19.905795Z",
      updated_at: "2026-11-20T01:38:19.905806Z",
    },
    {
      first_name: "Lorna",
      middle_name: "Santos",
      last_name: "Alcantara",
      suffix: null,
      birthdate: "1970-06-25",
      birth_place: "San Pablo City, Laguna",
      sex: "Female",
      civil_status: "Widow/Widower",
      occupation: null,
      house_number: "247",
      street_id: 7,
      purok: 6,
      resident_since_year: null,
      resident_since_birth: true,
      resident_type: null,
      id_number: null,
      voter_registration: "registered",
      residency_type: "renting",
      emergency_contact_name: null,
      emergency_contact_address: null,
      emergency_contact_phone: null,
      id: "805d2ece-77a6-4eae-8100-4865df06b28c",
      full_name: "Lorna Santos Alcantara",
      age: 56,
      sector_ids: [],
      has_photo: false,
      id_status: "none",
      id_valid_until: null,
      id_validity_months: 6,
      voter_proof_verified_at: null,
      voter_proof_verified_by_name: null,
      status: "active",
      archive_reason: null,
      archived_at: null,
      archived_by_name: null,
      created_at: "2026-11-20T01:38:19.940292Z",
      updated_at: "2026-11-20T01:38:19.940300Z",
    },
  ],
  count: 54,
}
const barangayIds = {
  count: 3,
  data: [0, 1, 2].map((i) => ({
    issuance_id: `a${i}`,
    reference_no: `BRGY-2026-00012${i}`,
    resident_id: `r${i}`,
    resident_name: "Maria Cristina Flores Dela Cruz-Villanueva",
    resident_status: "active",
    id_number: `2026-000${i}`,
    transaction_type: "Renewal",
    issue_date: `2026-03-0${i + 1}`,
    valid_until: `2027-03-0${i + 1}`,
    status: ["valid", "expiring_soon", "expired"][i],
  })),
}
const streets = [
  { id: 3, name: "Don Pedro Maglinao Street" },
  { id: 7, name: "Rizal Extension Road" },
]
const documentTypes = [
  {
    id: 1,
    code: "BARANGAY_CLEARANCE",
    name: "Barangay Clearance",
    category: "clearance",
    print_mode: "overlay",
    validity_months: 2,
    one_per_resident: false,
    signatory_default_position: null,
  },
]
const issuances = {
  data: [
    {
      id: "324269c8-5718-4b80-9c1b-758c8de9a61c",
      reference_no: "ISS-2026-000032",
      status: "issued",
      document_type_id: 1,
      document_type_code: "BARANGAY_CLEARANCE",
      resident_id: "7d6b7b8d-33b2-4766-8998-1cc14b85b5cf",
      resident_name: "Rowena Flores Mendoza Sr.",
      issue_date: "2026-11-20",
      purpose_id: null,
      expires_on: "2027-01-20",
      issued_at: "2026-11-20T01:38:44.987923Z",
      corrects_issuance_id: null,
      created_at: "2026-11-20T01:38:44.962818Z",
      archived_at: null,
      archived_by_name: null,
      archive_reason: null,
      original_status: null,
    },
    {
      id: "aadf8464-bf33-4c93-b377-7d6b41dae6df",
      reference_no: "ISS-2026-000031",
      status: "issued",
      document_type_id: 1,
      document_type_code: "BARANGAY_CLEARANCE",
      resident_id: "0935ea6b-8736-41a0-b9ac-0e8050a14ac5",
      resident_name: "Dennis Rivera Mendoza",
      issue_date: "2026-11-20",
      purpose_id: null,
      expires_on: "2027-01-20",
      issued_at: "2026-11-20T01:38:44.946032Z",
      corrects_issuance_id: null,
      created_at: "2026-11-20T01:38:44.920415Z",
      archived_at: null,
      archived_by_name: null,
      archive_reason: null,
      original_status: null,
    },
  ],
  count: 32,
}

// Officials and Activity Log (321): the Filipino Officials table was 45 px too wide at
// 1280 px and the Activity Log 271 to 297 px (a very long e-mail and detail lines).
const officials = [
  {
    id: "44444444-0000-0000-0000-000000000001",
    full_name: "Hon. Maria Cristina Flores Dela Cruz-Villanueva",
    position: "Sangguniang Kabataan Chairperson",
    term_start: "2023-11-01",
    term_end: "2026-10-30",
    is_elected: true,
    is_current: false,
  },
  {
    id: "44444444-0000-0000-0000-000000000002",
    full_name: "Official Two",
    position: "Punong Barangay",
    term_start: "2023-11-01",
    term_end: null,
    is_elected: true,
    is_current: true,
  },
]
const activity = {
  count: 2,
  data: [1, 2].map((n) => ({
    id: n,
    occurred_at: "2026-11-20T01:38:44.987923Z",
    actor_user_id: "33333333-0000-0000-0000-000000000001",
    actor_email:
      "maria.cristina.dela.cruz.villanueva@barangaymayondon.example.test",
    is_own: false,
    action: "issuance.void",
    module: "issuances",
    record_type: "issuance",
    record_id: "ISS-2026-000032-long-reference",
    outcome: "success",
    reason:
      "Replaced by correction ISS-2026-000033. Reason: wrong purpose typed",
    details: {
      automatic: true,
      document_type: "BARANGAY_CLEARANCE",
      reference_no: "ISS-2026-000032",
    },
  })),
}

const pages = [
  {
    path: "/records",
    name: "Records",
    widths: [1280, 1264, 1152, 1024, 776, 390],
  },
  {
    path: "/issuances",
    name: "Issuance History",
    widths: [1280, 1024, 776, 390],
  },
  {
    path: "/records?view=barangay-ids",
    name: "Barangay IDs",
    widths: [1280, 1024, 776, 390],
  },
  {
    path: "/officials",
    name: "Officials",
    widths: [1280, 1152, 1024, 776, 390],
  },
  {
    path: "/activity-log",
    name: "Activity Log",
    widths: [1280, 1152, 1024, 776, 390],
  },
  {
    path: "/records",
    name: "Archived residents",
    widths: [1280, 1024, 776, 390],
    tab: /^(Archived|Naka-archive)$/,
  },
]

for (const language of ["en", "fil"])
  for (const { path, name, widths, tab } of pages)
    for (const width of widths) {
      test(`${name} table fits ${width} px without scrolling (${language})`, async ({
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
          if (url.includes("/activity/options"))
            return json({ modules: [], actions: [], outcomes: [], actors: [] })
          if (url.includes("/activity/")) return json(activity)
          if (url.includes("/officials/")) return json(officials)
          if (url.includes("/lookups/document-types"))
            return json(documentTypes)
          if (url.includes("/lookups/streets")) return json(streets)
          if (url.includes("/barangay-ids")) return json(barangayIds)
          if (url.includes("/lookups/")) return json([])
          if (url.includes("/dashboard"))
            return json({ total_issued: 2, by_document_type: [] })
          if (url.includes("/residents/") && !url.includes("/residents/stats"))
            return json(residents)
          if (url.includes("/issuances/")) return json(issuances)
          return json({ data: [], count: 0 })
        })
        await page.addInitScript((lang) => {
          localStorage.setItem("access_token", "test-token")
          localStorage.setItem("app-language", lang)
          localStorage.setItem("vite-ui-theme", "light")
        }, language)
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        if (tab) await page.getByText(tab).first().click()

        const table = page.locator("table").first()
        await expect(table.locator("tbody tr").first()).toBeVisible()
        const over = await table.evaluate((el) => {
          const box = el.closest(".overflow-x-auto") as HTMLElement
          return box.scrollWidth - box.clientWidth
        })
        expect(over).toBeLessThanOrEqual(1)
      })
    }
