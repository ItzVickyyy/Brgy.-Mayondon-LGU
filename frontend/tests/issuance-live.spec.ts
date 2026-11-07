import { expect, test } from "@playwright/test"
import {
  LookupsService,
  OfficialsService,
  ResidentsService,
  UsersService,
} from "@/client"
import { client } from "@/client/client.gen"
import type { DocumentCode } from "@/components/Issuances/NewIssuance/documentConfig"
import { issuanceApi } from "@/components/Issuances/NewIssuance/issuanceApi"
import type { IssuanceInput } from "@/components/Issuances/NewIssuance/schemas"

/**
 * Drives the REAL New Issuance adapter (issuanceApi.ts) against a running
 * backend. Skipped unless LIVE_API_URL is set, so normal runs and CI ignore it.
 *
 *   LIVE_API_URL=http://localhost:8000 LIVE_API_EMAIL=admin@example.com \
 *   LIVE_API_PASSWORD=... bunx playwright test tests/issuance-live.spec.ts
 *
 * Use a throw-away database: it creates streets, officials, residents and
 * issued documents (synthetic names only) and does not clean them up.
 */
const baseURL = process.env.LIVE_API_URL
const email = process.env.LIVE_API_EMAIL ?? ""
const password = process.env.LIVE_API_PASSWORD ?? ""

test.skip(!baseURL, "Set LIVE_API_URL to run the live API checks.")
test.describe.configure({ mode: "serial" })

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
  "base64",
)

const run = Date.now().toString(36)
let token = ""
let signatoryId = ""
let witnessId = ""
const issuedIds: Record<string, string> = {}

async function login(user: string, pass: string) {
  const response = await fetch(`${baseURL}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: user, password: pass }),
  })
  expect(response.status, "login").toBe(200)
  return ((await response.json()) as { access_token: string }).access_token
}

function useToken(value: string) {
  token = value
  client.setConfig({ baseURL, auth: () => token })
}

async function newResident(label: string, sectors: string[] = []) {
  const resident = await issuanceApi.createResident({
    firstName: `Live${label}`,
    middleName: "T.",
    lastName: `Check${run}`,
    birthdate: "1990-01-01",
    birthplace: "Los Baños, Laguna",
    sex: "Female",
    civilStatus: "Single",
    houseNumber: "12",
    street: "Live Test Street",
    purok: 1,
    residentSinceYear: 2010,
    residentSinceBirth: false,
  })
  await client.put({
    url: "/api/v1/residents/{resident_id}/photo",
    path: { resident_id: resident.id },
    body: PNG,
    headers: { "Content-Type": "image/png" },
    security: [{ scheme: "bearer", type: "http" }],
  })
  await ResidentsService.updateResident({
    path: { resident_id: resident.id },
    body: {
      emergency_contact_name: "Fictional Contact",
      emergency_contact_address: "Purok 1, Mayondon",
      emergency_contact_phone: "09000000000",
    },
  })
  if (sectors.length) await issuanceApi.updateResident(resident.id, { sectors })
  return resident
}

const today = new Date().toISOString().slice(0, 10)
const identification = {
  idTypeId: 1,
  idNumber: "LIVE-1234",
  placeOfIssue: "Los Baños, Laguna",
  dateOfIssue: today,
}
const payment = { officialReceiptNo: "", isFree: true }

function inputs(
  residentId: string,
): Record<DocumentCode, { sectors?: string[]; input: IssuanceInput }> {
  const base = { issueDate: today, residentId, status: "issued" as const }
  return {
    BARANGAY_CLEARANCE: {
      input: {
        ...base,
        documentType: "BARANGAY_CLEARANCE",
        purposeText: "Employment",
        identification,
        payment,
        details: { type: "BARANGAY_CLEARANCE" },
      },
    },
    FRANCHISE_CLEARANCE: {
      input: {
        ...base,
        documentType: "FRANCHISE_CLEARANCE",
        identification,
        payment,
        details: {
          type: "FRANCHISE_CLEARANCE",
          associationName: `Live Association ${run}`,
          make: "Fictional Make",
          bodyType: "TRICYCLE",
          motorNumber: `MOTOR-${run}`,
          color: "Blue",
          plateNumber: `LV-${run}`.toUpperCase(),
        },
      },
    },
    UTILITY_CLEARANCE: {
      input: {
        ...base,
        documentType: "UTILITY_CLEARANCE",
        identification,
        payment,
        details: {
          type: "UTILITY_CLEARANCE",
          services: ["electric"],
          connectionType: "new",
          classification: "residential",
          location: "Barangay Mayondon",
        },
      },
    },
    RESIDENCY: {
      input: {
        ...base,
        documentType: "RESIDENCY",
        purposeText: "School enrollment",
        signatoryOfficialId: signatoryId,
        details: { type: "RESIDENCY" },
      },
    },
    INDIGENCY: {
      sectors: ["Senior Citizen"],
      input: {
        ...base,
        documentType: "INDIGENCY",
        purposeText: "Medical assistance",
        sectors: [{ sectorId: 1 }],
        details: { type: "INDIGENCY", addressedToOffice: "Fictional Office" },
      },
    },
    ASSISTANCE: {
      sectors: ["Senior Citizen"],
      input: {
        ...base,
        documentType: "ASSISTANCE",
        signatoryOfficialId: signatoryId,
        sectors: [{ sectorId: 1 }],
        details: {
          type: "ASSISTANCE",
          assistanceType: "financial",
          forSelf: true,
        },
      },
    },
    MARGINALIZED_SECTOR: {
      sectors: ["Senior Citizen"],
      input: {
        ...base,
        documentType: "MARGINALIZED_SECTOR",
        signatoryOfficialId: signatoryId,
        sectors: [{ sectorId: 1 }],
        details: {
          type: "MARGINALIZED_SECTOR",
          healthCondition: "Fictional test condition",
        },
      },
    },
    FIRST_TIME_JOBSEEKER: {
      input: {
        ...base,
        documentType: "FIRST_TIME_JOBSEEKER",
        signatoryOfficialId: signatoryId,
        details: {
          type: "FIRST_TIME_JOBSEEKER",
          educationalAttainment: "College",
          course: "N/A",
          isJobstartBeneficiary: false,
          witnessOfficialId: witnessId,
          parts: ["applicant_sheet", "oath", "certification"],
        },
      },
    },
    BARANGAY_ID: {
      input: {
        ...base,
        documentType: "BARANGAY_ID",
        details: {
          type: "BARANGAY_ID",
          transactionType: "new",
          validUntil: `${new Date().getFullYear() + 1}-12-31`,
          idNumber: `LIVE-${run}`.toUpperCase(),
        },
      },
    },
  }
}

const codes: DocumentCode[] = [
  "BARANGAY_CLEARANCE",
  "FRANCHISE_CLEARANCE",
  "UTILITY_CLEARANCE",
  "RESIDENCY",
  "INDIGENCY",
  "ASSISTANCE",
  "MARGINALIZED_SECTOR",
  "FIRST_TIME_JOBSEEKER",
  "BARANGAY_ID",
]

test("set up an admin session, a street and two officials", async () => {
  useToken(await login(email, password))
  await LookupsService.createStreet({
    body: { name: "Live Test Street" },
  }).catch(
    () => undefined, // already there from an earlier run
  )
  const make = async (
    full_name: string,
    position: string,
    is_elected: boolean,
  ) =>
    (
      await OfficialsService.createOfficial({
        body: {
          full_name,
          position,
          term_start: "2026-11-01",
          term_end: null,
          is_elected,
          is_current: true,
        },
      })
    ).data.id
  signatoryId = await make(`Live Punong ${run}`, "Punong Barangay", true)
  witnessId = await make(`Live Secretary ${run}`, "Barangay Secretary", false)
  const officials = await issuanceApi.getOfficials()
  expect(officials.map((official) => official.id)).toEqual(
    expect.arrayContaining([signatoryId, witnessId]),
  )
})

for (const code of codes) {
  test(`${code} can be created and issued through the adapter`, async () => {
    const spec = inputs("placeholder")[code]
    const resident = await newResident(
      code.replace(/_/g, "").toLowerCase(),
      spec.sectors,
    )
    const { input } = inputs(resident.id)[code]
    const result = await issuanceApi.createIssuance(input)
    expect(result.status).toBe("issued")
    expect(result.id).toBeTruthy()
    issuedIds[code] = result.id
    const stored = await issuanceApi.getIssuance(result.id)
    expect(stored?.status).toBe("issued")
  })
}

test("a draft can be saved and discarded", async () => {
  const resident = await newResident("DRAFT")
  const { input } = inputs(resident.id).RESIDENCY
  const draft = await issuanceApi.createIssuance({ ...input, status: "draft" })
  expect(draft.status).toBe("draft")
  await issuanceApi.deleteDraft(draft.id)
  expect(await issuanceApi.getIssuance(draft.id)).toBeUndefined()
})

test("an admin can correct then void an issued document", async () => {
  const id = issuedIds.RESIDENCY
  expect(id).toBeTruthy()
  const correction = await issuanceApi.correctIssuance(
    id,
    "Live test correction",
  )
  expect(correction.status).toBe("draft")
  await issuanceApi.deleteDraft(correction.id)
  const voided = await issuanceApi.voidIssuance(id, "Live test void")
  expect(voided.status).toBe("voided")
})

test("a resident can only get one First-Time Jobseeker document", async () => {
  const id = issuedIds.FIRST_TIME_JOBSEEKER
  const stored = await issuanceApi.getIssuance(id)
  expect(stored?.residentId).toBeTruthy()
  const again = inputs(stored?.residentId ?? "").FIRST_TIME_JOBSEEKER.input
  await expect(issuanceApi.createIssuance(again)).rejects.toMatchObject({
    status: 409,
  })
})

// ------------------------------------------------------------ staff account
// Clerks are Staff, so everything below runs with a Staff token.

const staffEmail = `live-staff-${run}@example.com`
const staffPassword = `Staff-${run}-Pw-12345!`
let staffToken = ""
let adminToken = ""

/** The HTTP status of a failed call, or 0 when it unexpectedly succeeds. */
async function statusOf(call: Promise<unknown>) {
  try {
    await call
    return 0
  } catch (error) {
    const caught = error as {
      status?: number
      response?: { status?: number }
    }
    return caught.status ?? caught.response?.status ?? -1
  }
}

test("staff: an admin creates a staff account and it can sign in", async () => {
  adminToken = token
  await UsersService.createUser({
    body: {
      email: staffEmail,
      password: staffPassword,
      full_name: "Live Staff",
      role: "staff",
    },
  })
  staffToken = await login(staffEmail, staffPassword)
  useToken(staffToken)
})

test("staff: can register a resident and issue a document", async () => {
  useToken(staffToken)
  const resident = await newResident("staffissue")
  const { input } = inputs(resident.id).RESIDENCY
  const result = await issuanceApi.createIssuance(input)
  expect(result.status).toBe("issued")
})

test("staff: can read the officials list used for signatories", async () => {
  useToken(staffToken)
  const officials = await issuanceApi.getOfficials()
  expect(officials.map((official) => official.id)).toEqual(
    expect.arrayContaining([signatoryId, witnessId]),
  )
})

test("staff: an unknown street gets a clear 'ask the administrator' message", async () => {
  useToken(staffToken)
  const attempt = issuanceApi.createResident({
    firstName: "Livestreet",
    lastName: `Check${run}`,
    birthdate: "1991-02-03",
    sex: "Male",
    civilStatus: "Single",
    street: `Not A Listed Street ${run}`,
    purok: 1,
    residentSinceBirth: true,
  })
  await expect(attempt).rejects.toMatchObject({
    message: expect.stringContaining("Ask the administrator"),
  })
})

test("staff: an unknown tricycle association gets the same clear message", async () => {
  useToken(staffToken)
  const resident = await newResident("staffassoc")
  const { input } = inputs(resident.id).FRANCHISE_CLEARANCE
  if (input.details.type !== "FRANCHISE_CLEARANCE") throw new Error("fixture")
  const attempt = issuanceApi.createIssuance({
    ...input,
    details: {
      ...input.details,
      associationName: `Not A Listed Association ${run}`,
      plateNumber: `ST-${run}`.toUpperCase(),
      motorNumber: `STM-${run}`,
    },
  })
  await expect(attempt).rejects.toMatchObject({
    message: expect.stringContaining("Ask the administrator"),
  })
})

test("staff: cannot void an issued document", async () => {
  useToken(staffToken)
  const id = issuedIds.BARANGAY_CLEARANCE
  expect(id).toBeTruthy()
  expect(
    await statusOf(issuanceApi.voidIssuance(id, "Staff should not void")),
  ).toBe(403)
  expect((await issuanceApi.getIssuance(id))?.status).toBe("issued")
})

test("staff: cannot add officials or streets", async () => {
  useToken(staffToken)
  expect(
    await statusOf(
      OfficialsService.createOfficial({
        body: {
          full_name: "Live Intruder",
          position: "Barangay Clerk",
          term_start: today,
          term_end: null,
          is_elected: false,
          is_current: true,
        },
      }),
    ),
  ).toBe(403)
  expect(
    await statusOf(
      LookupsService.createStreet({ body: { name: `Staff Street ${run}` } }),
    ),
  ).toBe(403)
})

test("staff: cannot reach the user list", async () => {
  useToken(staffToken)
  expect(await statusOf(UsersService.readUsers())).toBe(403)
  useToken(adminToken)
})

// ------------------------------------------------- staff: clerk-facing rules
// Each check asserts the exact sentence a clerk would read in the dialog.

const nextYear = new Date().getFullYear() + 1

function idInput(
  residentId: string,
  transactionType: "new" | "renewal" | "replacement",
  options: { idNumber?: string; validUntil?: string } = {},
): IssuanceInput {
  return {
    documentType: "BARANGAY_ID",
    issueDate: today,
    residentId,
    status: "issued",
    details: {
      type: "BARANGAY_ID",
      transactionType,
      validUntil: options.validUntil ?? `${nextYear}-12-31`,
      idNumber: options.idNumber,
    },
  }
}

function franchiseInput(
  residentId: string,
  tricycle: { plate: string; motor: string; color?: string },
): IssuanceInput {
  const { input } = inputs(residentId).FRANCHISE_CLEARANCE
  if (input.details.type !== "FRANCHISE_CLEARANCE") throw new Error("fixture")
  return {
    ...input,
    details: {
      ...input.details,
      plateNumber: tricycle.plate,
      motorNumber: tricycle.motor,
      color: tricycle.color ?? input.details.color,
    },
  }
}

const idNumber = `LIVE-ID-${run}`.toUpperCase()
let idResidentId = ""

test("staff: a new Barangay ID needs a typed ID number", async () => {
  useToken(staffToken)
  const resident = await newResident("idnumber")
  idResidentId = resident.id
  await expect(
    issuanceApi.createIssuance(idInput(resident.id, "new")),
  ).rejects.toMatchObject({
    message: "Type the Barangay ID number for this card.",
  })
})

test("staff: renewal is refused when the resident has no earlier ID", async () => {
  useToken(staffToken)
  await expect(
    issuanceApi.createIssuance(idInput(idResidentId, "renewal")),
  ).rejects.toMatchObject({
    message: "This resident has no earlier Barangay ID. Choose New instead.",
  })
})

test("staff: the 'valid until' date must be after the issue date", async () => {
  useToken(staffToken)
  await expect(
    issuanceApi.createIssuance(
      idInput(idResidentId, "new", { idNumber, validUntil: today }),
    ),
  ).rejects.toMatchObject({
    message: "The “Valid until” date must be after the issue date.",
  })
})

test("staff: issue a new ID, refuse a second new one, then renew", async () => {
  useToken(staffToken)
  const first = await issuanceApi.createIssuance(
    idInput(idResidentId, "new", { idNumber }),
  )
  expect(first.status).toBe("issued")
  await expect(
    issuanceApi.createIssuance(idInput(idResidentId, "new", { idNumber })),
  ).rejects.toMatchObject({
    message:
      "This resident already has a Barangay ID. Choose Renewal or Replacement instead.",
  })
  const renewal = await issuanceApi.createIssuance(
    idInput(idResidentId, "renewal", { validUntil: `${nextYear + 1}-12-31` }),
  )
  expect(renewal.status).toBe("issued")
})

test("staff: an ID number cannot be reused by another resident", async () => {
  useToken(staffToken)
  const other = await newResident("idclash")
  await expect(
    issuanceApi.createIssuance(idInput(other.id, "new", { idNumber })),
  ).rejects.toMatchObject({
    message: "This ID number is already used by another resident.",
  })
})

test("staff: tricycle plate and motor numbers are protected", async () => {
  useToken(staffToken)
  // The admin run above registered this tricycle (Blue). Same numbers with a
  // different color must be refused.
  const knownPlate = `LV-${run}`.toUpperCase()
  const knownMotor = `MOTOR-${run}`.toUpperCase()
  const mismatchOwner = await newResident("trimismatch")
  await expect(
    issuanceApi.createIssuance(
      franchiseInput(mismatchOwner.id, {
        plate: knownPlate,
        motor: knownMotor,
        color: "Red",
      }),
    ),
  ).rejects.toMatchObject({
    message:
      "This plate or motor number is already on file with different tricycle details. Check the numbers, make, color and association.",
  })

  // Register a second tricycle, then mix one number from each.
  const second = {
    plate: `ST2-${run}`.toUpperCase(),
    motor: `STM2-${run}`.toUpperCase(),
  }
  const owner = await newResident("tricycle2")
  expect(
    (await issuanceApi.createIssuance(franchiseInput(owner.id, second))).status,
  ).toBe("issued")
  const mixer = await newResident("trimixed")
  await expect(
    issuanceApi.createIssuance(
      franchiseInput(mixer.id, { plate: knownPlate, motor: second.motor }),
    ),
  ).rejects.toMatchObject({
    message:
      "The plate number and the motor number belong to two different tricycles on file. Check both numbers.",
  })
})

test("staff: a resident with missing details is told what to add", async () => {
  useToken(staffToken)
  // Created straight through the API so it has no house number, street or purok.
  const bare = (
    await ResidentsService.createResident({
      body: {
        first_name: "Livebare",
        last_name: `Check${run}`,
        sex: "Female",
        civil_status: "Single",
        resident_since_birth: true,
      },
    })
  ).data
  const { input } = inputs(bare.id).RESIDENCY
  let message = ""
  try {
    await issuanceApi.createIssuance(input)
  } catch (error) {
    message = (error as Error).message
  }
  // Required fields depend on the document: Residency needs the address, not
  // the birthdate.
  expect(message).toContain("The resident record is missing:")
  expect(message).toContain("house number")
  expect(message).toContain("street")
  expect(message).toContain("purok")
  expect(message).not.toContain("birthdate")
})

test("staff: can edit a resident through the adapter", async () => {
  useToken(staffToken)
  const resident = await newResident("editme")
  const updated = await issuanceApi.updateResident(resident.id, {
    civilStatus: "Married",
    houseNumber: "99",
  })
  expect(updated.civilStatus).toBe("Married")
  expect(updated.houseNumber).toBe("99")
  await expect(
    issuanceApi.updateResident(resident.id, {
      street: `Unlisted Edit Street ${run}`,
    }),
  ).rejects.toMatchObject({
    message: expect.stringContaining("Ask the administrator"),
  })
})

// -------------------------------------- staff: corrections, archive, search
// Same idea: each check asserts what the clerk or admin would actually read.

test("staff: a correction opens a draft, blocks a second one, and issues", async () => {
  useToken(staffToken)
  const resident = await newResident("correct")
  const original = await issuanceApi.createIssuance(
    inputs(resident.id).BARANGAY_CLEARANCE.input,
  )
  expect(original.status).toBe("issued")

  const draft = await issuanceApi.correctIssuance(original.id, "Wrong purpose")
  expect(draft.status).toBe("draft")
  expect(draft.correctsIssuanceId).toBe(original.id)
  expect(draft.correctionReason).toBe("Wrong purpose")

  // A second correction while one is open: the sentence the clerk reads.
  await expect(
    issuanceApi.correctIssuance(original.id, "Another try"),
  ).rejects.toMatchObject({
    status: 409,
    message:
      "A correction for this document is already open. Finish or discard that draft first.",
  })

  // Issuing the draft keeps the link and leaves the original alone.
  const { input } = inputs(resident.id).BARANGAY_CLEARANCE
  const fixed = await issuanceApi.issueDraft(draft.id, {
    ...input,
    purposeText: "Scholarship",
  })
  expect(fixed.status).toBe("issued")
  expect(fixed.correctsIssuanceId).toBe(original.id)
  expect(fixed.id).toBe(draft.id)
  expect((await issuanceApi.getIssuance(original.id))?.status).toBe("issued")
})

test("staff: a draft cannot be corrected, only issued documents can", async () => {
  useToken(staffToken)
  const resident = await newResident("correctdraft")
  const draft = await issuanceApi.createIssuance({
    ...inputs(resident.id).RESIDENCY.input,
    status: "draft",
  })
  await expect(
    issuanceApi.correctIssuance(draft.id, "Not valid"),
  ).rejects.toMatchObject({
    status: 409,
    message: "Only an issued document can be corrected",
  })
  await issuanceApi.deleteDraft(draft.id)
})

test("archived resident: staff cannot archive, admin can, and nothing new can be issued", async () => {
  useToken(staffToken)
  const resident = await newResident("archive")
  const issued = await issuanceApi.createIssuance(
    inputs(resident.id).RESIDENCY.input,
  )
  expect(issued.status).toBe("issued")

  // Staff are refused and the resident stays active.
  expect(
    await statusOf(
      ResidentsService.archiveResident({
        path: { resident_id: resident.id },
        body: { reason: "Staff should not archive" },
      }),
    ),
  ).toBe(403)
  expect(
    (
      await issuanceApi.searchResidents(
        `${resident.firstName} ${resident.lastName}`,
      )
    ).map((r) => r.id),
  ).toContain(resident.id)

  // Admin archives.
  useToken(adminToken)
  await ResidentsService.archiveResident({
    path: { resident_id: resident.id },
    body: { reason: "Moved away (live test)" },
  })

  useToken(staffToken)
  // Gone from the search box a clerk uses.
  expect(
    (
      await issuanceApi.searchResidents(
        `${resident.firstName} ${resident.lastName}`,
      )
    ).map((r) => r.id),
  ).not.toContain(resident.id)
  // No new document, no correction, no edit.
  await expect(
    issuanceApi.createIssuance(inputs(resident.id).RESIDENCY.input),
  ).rejects.toMatchObject({
    status: 409,
    message: "An archived resident cannot receive documents",
  })
  await expect(
    issuanceApi.correctIssuance(issued.id, "Resident is archived"),
  ).rejects.toMatchObject({
    status: 409,
    message: "An archived resident cannot receive documents",
  })
  await expect(
    issuanceApi.updateResident(resident.id, { houseNumber: "7" }),
  ).rejects.toMatchObject({
    message: "Archived residents cannot be edited; restore first",
  })

  // Admin restores and the clerk can work again.
  useToken(adminToken)
  await ResidentsService.restoreResident({
    path: { resident_id: resident.id },
  })
  useToken(staffToken)
  expect(
    (
      await issuanceApi.searchResidents(
        `${resident.firstName} ${resident.lastName}`,
      )
    ).map((r) => r.id),
  ).toContain(resident.id)
  const again = await issuanceApi.createIssuance(
    inputs(resident.id).RESIDENCY.input,
  )
  expect(again.status).toBe("issued")
})

test("staff: resident search finds by name, street and house number", async () => {
  useToken(staffToken)
  const resident = await newResident("searchme")
  const ids = async (query: string) =>
    (await issuanceApi.searchResidents(query)).map((r) => r.id)
  expect(await ids(`Livesearchme Check${run}`)).toContain(resident.id)
  expect(await ids(`livesearchme CHECK${run}`)).toContain(resident.id) // any case
  expect(await ids(`Livesearchme Live Test Street`)).toContain(resident.id)
  expect(await ids(`Livesearchme Check${run} 12`)).toContain(resident.id)
  expect(await ids(`Livesearchme Check${run} nomatchword`)).toEqual([])
  useToken(adminToken)
})
