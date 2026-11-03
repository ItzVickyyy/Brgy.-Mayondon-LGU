# 09 · Issuance Form → Database Map

Maps every input in the **New Issuance** dialog to a proposed table and column, so the backend tables (not yet in `backend/app/models.py`) can be built straight from the form. Field names follow `frontend/src/components/Issuances/NewIssuance/schemas.ts`, which is the contract the mock API (`issuanceApi.ts`) already uses.

**Status:** proposal for team review, derived from the form and the client's sample documents. Required-field rules are still open **(D-14)**. Use synthetic data only.

## Design rules the form follows

1. **One input, one column.** No input writes to two places, and no value is typed twice. Values that already live on the resident record (birthdate, address, civil status, residing-since, sector, photo, emergency contact) are *read* from the resident. They appear in the form only when missing, and are saved back to the resident, not to the issuance.
2. **Pick from lookups, don't free-type.** Purpose, sector, ID type, official, tricycle association and street are lookup tables. The form stores the lookup id. Purpose and association may be added on the fly (combobox) and are inserted into their lookup table.
3. **Snapshot at issue time.** When status becomes `issued`, the resident's printed values are copied into `issuance_resident_snapshot`, so a later edit to the resident never changes a document that was already handed out.
4. **Document-specific data lives in its own detail table**, not as nullable columns on `issuances`. This keeps `issuances` small and lets each document evolve independently.
5. **Issued records are never edited or deleted.** Corrections create a new row (`corrects_issuance_id`, `correction_reason`). Voiding sets `status = voided` plus `void_reason` (admin only).

## Core tables

### `issuances`

| Form input | Form key | Column | Type / rule | Source |
|---|---|---|---|---|
| (auto) | — | `id` | UUID PK | system |
| (auto) | — | `reference_no` | text, unique, e.g. `ISS-2026-000001` | system sequence |
| Step 1 tile | `documentType` | `document_type_id` | FK `document_types` | picker |
| Step 2 resident | `residentId` | `resident_id` | FK `residents`, must be Active | search |
| Date on document | `issueDate` | `issue_date` | date, default today | input |
| Purpose | `purposeText` | `purpose_id` | FK `issuance_purposes` (nullable) | select / combobox |
| Remarks | `remarks` | `remarks` | text, default `NO DEROGATORY RECORD ON FILE` for clearance | optional |
| Signatory | `signatoryOfficialId` | `signatory_official_id` | FK `officials` (null when pre-printed) | select, defaulted per document |
| (Issue / Save draft) | `status` | `status` | enum `draft`, `issued`, `voided` | button |
| (auto) | — | `issued_by_user_id` | FK `users` | session |
| (auto) | — | `issued_at`, `created_at` | timestamptz | system |
| (auto) | — | `expires_on` | date, null unless an approved rule exists (Clearance: 2 months, First-Time Jobseeker: 1 year) | derived from `document_types.validity_months` |
| Correction flow | — | `corrects_issuance_id`, `correction_reason` | FK self, text | system |
| Void flow | — | `void_reason` | text, admin only | system |

### `issuance_identification` (1:1, only Clearance, Franchise, Electrical/Water, optional on Residency)

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Valid ID presented | `identification.idTypeId` | `id_type_id` | FK `id_types` (includes CTC) |
| ID number | `identification.idNumber` | `id_number` | text, required |
| Place of issue | `identification.placeOfIssue` | `place_of_issue` | text, default `Los Baños, Laguna` |
| Date of issue | `identification.dateOfIssue` | `date_of_issue` | date, default today |

### `issuance_payments` (1:1, same documents as above)

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Free of charge | `payment.isFree` | `is_free` | bool |
| Official receipt no. | `payment.officialReceiptNo` | `official_receipt_no` | text; `FOC` when free; unique per non-free receipt |

### `issuance_sectors` (N:1 to `issuances`, Indigency 1–2, Assistance 1, Marginalized 1)

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Sector | `sectors[].sectorId` | `sector_id` | FK `sectors` |
| Sector ID number | `sectors[].idNumber` | `sector_id_number` | text, optional (Marginalized Sector) |

### `issuance_resident_snapshot` (1:1, written only when `issued`)

`full_name`, `address_line`, `birth_date`, `birth_place`, `sex`, `civil_status`, `resident_since_year`, `resident_since_birth`. Copied from the resident at the moment of issue.

## Document detail tables (1:1 with `issuances`)

| Table | Form input → column |
|---|---|
| `issuance_barangay_clearance` | Purpose note → `purpose_note`; Referred by (c/o) → `referred_by_official_id` (FK `officials`, null = none) |
| `issuance_franchise` | Tricycle association / make / body / motor no. / color / plate no. → **`tricycle_id`** (FK `tricycles`). The form still shows the 6 inputs; on issue the API finds a tricycle by plate or motor number, or creates one, so a tricycle is stored once and reused. `tricycles(association_id, make, body_type, motor_number, color, plate_number)`; unique on plate and on motor number |
| `issuance_utility` | Service → `has_electric`, `has_water` (bools, at least one); Type of connection → `connection_type` (`new` or `reconnection`); Classification → `classification` (`residential` or `commercial`); Location → `location` |
| `issuance_indigency` | Office addressed to → `addressed_to_office` (sectors and purpose are on the core tables) |
| `issuance_assistance` | Assistance requested → `assistance_type` (`financial`, `medical`, `burial`); For → `for_self` (bool); Name → `beneficiary_name`; Relationship → `beneficiary_relationship` (both required when `for_self` is false) |
| `issuance_marginalized_sector` | Health condition → `health_condition`. **Sensitive:** restricted read access (the list API already masks it as `[restricted]`) |
| `issuance_first_time_jobseeker` | Educational attainment → `educational_attainment`; Course → `course` (default `N/A`); JobStart beneficiary → `is_jobstart_beneficiary` (bool); Witness → `witness_official_id` (FK `officials`). "Parts to print" is a print-time choice and is **not stored**. Rule: one issued row per resident, enforced with a partial unique index on `(resident_id)` where `status = 'issued'` |
| `issuance_barangay_id` | Transaction → `transaction_type` (`new`, `renewal`, `replacement`); Valid until → `valid_until`. The ID number is assigned on issue and stored on the resident (`residents.id_number`) |

Residency has no detail table (wording is open, D-15). "Residing since" is a resident-record value, not an issuance column.

## Values saved back to `residents` (never to `issuances`)

Collected inline in step 2 only when the chosen document needs them and the record lacks them:

| Needed by | Column |
|---|---|
| all (address on document) | `house_number`, `street_id`, `purok` |
| Clearance, Jobseeker, ID, Indigency | `birthdate` |
| Clearance, ID | `birthplace` |
| Clearance, Jobseeker, ID | `civil_status` |
| Jobseeker, ID | `sex` |
| Residency, Jobseeker, Assistance | `resident_since_year`, `resident_since_birth` |
| Assistance, Marginalized | `resident_sectors` |
| ID | `photo_url`, `emergency_contact_name`, `emergency_contact_address`, `emergency_contact_phone` |

## New resident (quick add in step 2)

Shown when the person is not found in the search. The name is one row: First name, Middle name, Last name, Extension.

| Form input | Form key | Column | Rule |
|---|---|---|---|
| First name | `firstName` | `first_name` | text, required |
| Middle name | `middleName` | `middle_name` | text, optional |
| Last name | `lastName` | `last_name` | text, required |
| Extension | `suffix` | `suffix` | optional: `Jr.`, `Sr.`, `II`, `III`, `IV`, `V`. Blank when "None". Printed after the last name |
| Birthdate | `birthdate` | `birthdate` | date, required. One date box that opens a calendar on the year list, or can be typed. Cannot be in the future |
| Place of birth | `birthplace` | `birth_place` | text. Required only when the chosen document needs it (Barangay Clearance, Barangay ID). Otherwise optional and asked later if missing |
| Sex | `sex` | `sex` | `Male` or `Female` |
| Civil status | `civilStatus` | `civil_status` | lookup |
| House number, Street, Purok | `houseNumber`, `street`, `purok` | `house_number`, `street_id`, `purok` | required, same rule as the table above |
| Living here since | `residentSinceYear`, `residentSinceBirth` | `resident_since_year`, `resident_since_birth` | year or "since birth" |

## Drafts and automatic saving

The dialog saves a draft by itself about 1.5 seconds after the person stops typing, once a resident is chosen.

| Event | What happens to the data |
|---|---|
| First automatic save | Creates one `issuances` row with `status = 'draft'`. The form keeps its id |
| Later automatic saves | Update that same row. They never create a second one |
| Automatic saves and resident edits | `residentUpdates` (the yellow box) are **not** written. They are saved only with Save draft or Issue, so half-typed text never overwrites the resident record |
| Automatic saves and lookup lists | A draft does not add its purpose or association to `issuance_purposes` / `tricycle_associations`. Only an issued document does |
| Issue | The draft row is deleted and the issued row is created. The reference number comes from a counter, not from the row count, so deleting a draft cannot repeat a number |
| Discard changes | The draft row is deleted |
| Close, keep draft | The draft row stays with `status = 'draft'` |

The reference-number rule matters for the real backend: use a database sequence for `reference_no`.

## Lookup tables

`document_types(code, name, category, print_mode, validity_months, one_per_resident, signatory_default_position)` · `issuance_purposes` · `sectors` · `id_types` · `officials` (existing) · `tricycle_associations` · `streets`.

`document_types` mirrors `documentConfig.ts`. Seeding it from that file keeps the form and the database in sync.

## Suggested indexes and constraints

- `issuances(resident_id, document_type_id, status)` for the one-per-resident check and the resident history.
- `issuances(issue_date)` and `issuances(reference_no)` for the list page search.
- Check: `status = 'issued'` implies `issued_at` and `issued_by_user_id` not null.
- Check: `issuance_payments.is_free = true` implies `official_receipt_no = 'FOC'`.
