# 09 · Issuance Form → Database Map

Maps every input in the **New Issuance** dialog to a proposed table and column, so the backend tables (not yet in `backend/app/models.py`) can be built straight from the form. Field names follow `frontend/src/components/Issuances/NewIssuance/schemas.ts`, which is the contract the mock API (`issuanceApi.ts`) already uses.

**Status:** proposal for team review, derived from the form and the client's sample documents. Required-field rules are still open **(D-14)**. Use synthetic data only. The gaps found in the database review were settled on Nov 5, 2026: see *Settled design decisions* and *Tables the first draft did not define* below.

## Design rules the form follows

1. **One input, one column.** No input writes to two places, and no value is typed twice. Values that already live on the resident record (birthdate, address, civil status, residing-since, sector, photo, emergency contact) are *read* from the resident. They appear in the form only when missing, and are saved back to the resident, not to the issuance.
2. **Pick from lookups, don't free-type.** Purpose, sector, ID type, official, tricycle association and street are lookup tables. The form stores the lookup id. Purpose and association may be added on the fly (combobox) and are inserted into their lookup table.
3. **Snapshot at issue time.** When status becomes `issued`, the resident's printed values are copied into `issuance_resident_snapshot`, so a later edit to the resident never changes a document that was already handed out.
4. **Document-specific data lives in its own detail table**, not as nullable columns on `issuances`. This keeps `issuances` small and lets each document evolve independently.
5. **Archiving hides, never deletes.** An admin can archive an issued or voided record with a reason (`archived_at`, `archived_by_user_id`, `archive_reason`, `original_status`; `status` is never changed) and restore it later; restore is not an issue (no new reference number or date). Archived rows leave the default History list, the dashboard, reports, the expiring report and the Barangay ID list, cannot be voided, corrected or printed until restored, and still count for the same-day, one-per-resident, OR-number, ID-number and franchise checks. Audit actions: `issuance.archive`, `issuance.restore`.
6. **Issued records are never edited or deleted.** Corrections create a new row (`corrects_issuance_id`, `correction_reason`). Voiding sets `status = voided` plus `void_reason` (admin only). Issuing a correction also voids the document it replaces, automatically and in the same transaction (reason "Replaced by correction ISS-…", audit event `issuance.void` with `replaced_by` and `automatic`); this is allowed for staff because they may correct.
   Same-day repeats: for document types that are not one-per-resident, issuing a second copy for the same resident with the same issue date is refused with 409 `duplicate_same_day` until the request carries `confirm_duplicate: true` (the New Issuance dialog asks "Issue anyway"). Only issued copies count; voided copies and a correction's own original do not. Both copies stay issued and valid; no unique constraint.

## Settled design decisions (Nov 5, 2026)

These close the gaps found when the database plan was reviewed. They are **design decisions by the project owner, not client approvals**, and the open items they touch are named in the last column.

| # | Topic | Decision | Why | Related |
|---|---|---|---|---|
| 1 | Resident photos | Stored in the database in `resident_photos` as `bytea`: one row per resident, the processed PNG or WebP, at most 300 KB (checked by the API), type checked from the file's first bytes and not its name. There is **no `photo_url` column**. Photos are served only through an authenticated endpoint. | The backup script dumps only PostgreSQL, so files on disk would be missed by every backup and restore. Photos must never leave the host. A separate table keeps image bytes out of list queries. | D-18, D-35 |
| 2 | Barangay ID numbers | `residents.id_number` is the **current** number (unique when set). `issuance_barangay_id.id_number` is the number printed on that card. Every new, renewal or replacement ID is its own issuance row, so history is kept. | Goal GOAL-02: history must not be overwritten. | D-43 (numbering series built in patch 65, off until an administrator sets it; the barangay still has to confirm the latest number and the renewal rule) |
| 3 | Sensitive health condition | **No new permission.** Staff issue the Marginalized Sector certification, so they must be able to enter and print the value. List endpoints always return `[restricted]`. Only the single-issuance endpoint returns the value, and only to someone with `issuance.write`. Each read of the value is written to the audit log as `issuance.view_sensitive`. The value never appears in logs, exports or reports. | A "sensitive read" permission staff must hold anyway would restrict nothing. Masking by endpoint plus an audit trail does. | D-25 |
| 4 | Name fields | Residents use **`suffix`** (the form and API contract already use it). `user.extension_name` stays until the account cleanup. | Different table, different owner of the field. | — |
| 5 | Dates and time zone | Moments are `timestamptz` (UTC). Business dates are `date`: birthdate, `issue_date`, `date_of_issue`, `valid_until`, `date_of_payment`. "Today" and every expiry are computed in `Asia/Manila` (a `BUSINESS_TIMEZONE` setting), never from the server's UTC date. | The Docker host runs on UTC, so a document issued before 8 AM would carry yesterday's date. | — |
| 6 | Derived values | Age and ID status (Valid, Expiring soon, Expired, None) are computed when read, from the birthdate and the latest issued ID's `valid_until`. They are not stored. `issuances.expires_on` **is** stored, because the rule in force at issue time must stay with the document. | Stored copies go stale. | D-21 (expiring-soon threshold) |
| 7 | Accounts that issued documents | `issuances.issued_by_user_id` is `ON DELETE RESTRICT`. An account that issued anything is **deactivated, not deleted**, and `DELETE /users/{id}` answers 409 with that explanation. `audit_log.actor_user_id` is `ON DELETE SET NULL` and the actor's email is copied into the row, so history survives either way. | Doc 05 A6: disable access while keeping issuance history. | D-26 |
| 8 | Sex and civil status | Text columns with `CHECK` constraints, not lookup tables. | Short, fixed lists. | — |
| 9 | Backup history | No backup table in Version 1. The list comes from the files the backup script writes. | Nothing runs on a schedule yet. | D-35 |

## Tables the first draft did not define

### `residents`

| Column | Type / rule |
|---|---|
| `id` | UUID PK |
| `first_name`, `last_name` | text, required |
| `middle_name`, `suffix` | text, optional. `suffix` is one of `Jr.`, `Sr.`, `II`, `III`, `IV`, `V` |
| `birthdate` | `date`, not in the future. **Nullable**, because imported records may lack it. Documents that need it are blocked until it is filled (the form's "missing fields" check) |
| `birth_place` | text, optional |
| `sex` | text, `CHECK` in (`Male`, `Female`), optional |
| `civil_status` | text, `CHECK` in (`Single`, `Married`, `Legally Separated`, `Widow/Widower`), optional |
| `house_number` | text, optional |
| `street_id` | FK `streets`, optional |
| `purok` | smallint, greater than 0, optional |
| `resident_since_year`, `resident_since_birth` | smallint and bool (default false). `CHECK`: not both set |
| `resident_type` | text, optional. **Legacy (D-48):** free text, no longer shown in the form; kept so imported values are not lost. Superseded by `residency_type` |
| `residency_type` | text, `CHECK` in (`regular`, `new`, `renting`), optional; empty counts as regular (patch 61) |
| `voter_proof_verified_at`, `voter_proof_verified_by_user_id` | date and FK to `user` (`ON DELETE SET NULL`), optional. The day staff saw proof of voter registration and who recorded it. `CHECK`: a verifier needs a date. Changed only by `POST /residents/{id}/voter-proof` and `.../clear` (admin and staff, audited as `resident.voter_proof_verify` and `resident.voter_proof_clear`); only for `new` or `renting` residents |
| `id_number` | text, unique where not null (decision 2) |
| `voter_registration` | text, `CHECK` in (`registered`, `unregistered`), optional. The client's list remark; it is not proof (see `voter_proof_verified_at`) |
| `emergency_contact_name`, `_address`, `_phone` | text, optional |
| `status` | text, `CHECK` in (`active`, `archived`), default `active` |
| `archive_reason`, `archived_at`, `archived_by_user_id` | all required when `status = 'archived'` (`CHECK`), otherwise null. Residents are archived, never deleted (D-26) |
| `created_at`, `updated_at` | timestamptz |
| `created_by_user_id`, `updated_by_user_id` | FK `user`, `ON DELETE SET NULL` |

No `full_name` column. One backend function builds the display and printed name, so lists and prints always match. Indexes: `(lower(last_name), lower(first_name))`, `birthdate`, and a partial unique index on `id_number`. Duplicates are **warned about, not blocked**: if the same lowercased names and birthdate exist, the API says so and the clerk confirms (namesakes and twins exist).

### `streets`, `resident_sectors`, `resident_photos`

- `streets(id, name unique)`. Purok is a plain number on the resident.
- `resident_sectors(resident_id, sector_id)`, primary key on both columns. A resident has zero or more sectors. The per-issuance sector ID number stays on `issuance_sectors`.
- `resident_photos(resident_id PK/FK, content bytea, content_type, byte_size, updated_at, updated_by_user_id)`. `content_type` is `CHECK` in (`image/png`, `image/webp`) and `byte_size` is `CHECK` at most 307200.

### `officials`

`id` (UUID), `full_name`, `position`, `term_start` (date), `term_end` (date, optional), `is_elected` (bool), `is_current` (bool). Mark an official as not current instead of deleting: `issuances.signatory_official_id` and `witness_official_id` use `ON DELETE RESTRICT`. Whether the module stays in Version 1 is still D-23.

### `audit_log` (append only; one narrow exception)

A database trigger blocks UPDATE, DELETE and TRUNCATE. Since patch 57 the single exception is DELETE of a READ row (`resident.view`, `resident.list`, `barangay_id.list`) older than 90 days; the trigger enforces both limits itself. The clean-up is `python -m app.audit_cli prune-reads` (counts only unless `--delete`), and a real clean-up writes one `audit.prune` row (module `audit`, details `count`, `keep_days`). See `docs/11` section G item 10.

| Column | Type / rule |
|---|---|
| `id` | bigint identity PK |
| `occurred_at` | timestamptz, default now |
| `actor_user_id` | FK `user`, nullable, `ON DELETE SET NULL` |
| `actor_email` | text, copied at write time |
| `action` | text, for example `issuance.issue` (details include `duplicate_of`, the earlier reference number, when staff confirmed a second copy of the same document for the same resident on the same issue date), `issuance.void`, `issuance.print` (written by `POST /issuances/{id}/printed` just before the browser print dialog opens; `details.copy` counts prints of that document, 2 or more are reprints; the print does not start if the row cannot be written), `resident.archive`, `user.role_change`, and the READ rows `resident.view`, `resident.list`, `barangay_id.list` (see `docs/11` section G item 6) `report.export` and `audit.prune` |
| `module`, `record_type`, `record_id` | text. `record_id` is text so any table can be referenced |
| `outcome` | text, `CHECK` in (`success`, `failed`, `denied`) |
| `reason` | text, required for void, correction and archive |
| `details` | jsonb, never passwords, tokens, health conditions or unneeded personal data |

A database trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`, so the app cannot rewrite history even by mistake. A successful action writes its row in the **same transaction** as the change; denied and failed attempts are written separately because the main transaction rolls back. This table replaces the log line that `record_admin_action` writes today. Which actions must be logged, who reviews them and retention stay open (D-24, D-26).

**Reading it:** `GET /api/v1/activity` (filters: person, module, action, outcome, record, Manila date range) and `GET /api/v1/activity/options`. Staff see only their own rows (`activity.view_own`); the System Administrator sees everyone's (`activity.view_all`). Account actions (`user.create`, `user.update`, `user.role_change`, `user.password_change`, `user.update_self`, `user.delete`, `user.delete_self`) are written to this table as well as to the application log; unlike issuance and record changes, the create, update and role change rows are saved just after the change, not in the same transaction.

### `backup_runs` (backup history, D-35)

One row per backup attempt; the dump file itself is in the `backups` folder, not in the database.

| Column | Type / rule |
|---|---|
| `id` | UUID PK |
| `started_at` | timestamptz, default now, indexed |
| `finished_at` | timestamptz, nullable |
| `kind` | text, `CHECK` in (`scheduled`, `manual`) |
| `status` | text, `CHECK` in (`running`, `ok`, `failed`) |
| `file_name` | text, nullable. Always `mayondon-db-YYYYMMDD-HHMMSS-fff.dump` (Manila time) |
| `size_bytes` | bigint, nullable |
| `sha256` | text, nullable. Checksum recorded when the file was made; verification compares against it |
| `verified_at` | timestamptz, nullable. Last time the archive was read back with `pg_restore --list` and matched its checksum |
| `created_by` | FK `user`, nullable, `ON DELETE SET NULL`. Empty for scheduled runs |
| `created_by_email` | text, copied at write time |
| `error` | text, nullable, trimmed to 500 characters, never contains the database password |

Rows are kept after retention deletes an old file (the API reports `file_exists`). Applying the schedule's retention never removes the newest backup that was checked and recorded as good. A restore **replaces** this table with the backup's own copy of it, so after a restore the history shows only what the backup knew.

**API (System Administrator only, `backup.restore`):** `GET /api/v1/backups/` (newest first, plus `tool_available` and `keep_copies`), `POST /api/v1/backups/` (manual backup; 409 if one is running, 503 if `pg_dump` or the folder is missing), `POST /api/v1/backups/{id}/verify`, `GET /api/v1/backups/{id}/download`, `POST /api/v1/backups/{id}/restore-request` (checks the file, logs it, returns the PowerShell command; it does not restore). Audit actions: `backup.create`, `backup.verify`, `backup.download`, `backup.restore_requested`, with the file name and size only.

### `import_batches` and `import_rows` (masterlist import staging, D-19)

An uploaded `.csv` or `.xlsx` is parsed into staging first; nothing reaches `residents` until the System Administrator commits the batch. The client's real column names, required fields and duplicate rule are still open (D-19), so they are **settings of a batch**, not code.

`import_batches`: `id` UUID PK, `created_at`, `created_by` (FK `user`, `ON DELETE SET NULL`) and `created_by_email`, `file_name`, `file_type` (`csv`, `xlsx`), `status` (`uploaded`, `mapped`, `committed`, `cancelled`, `expired`, `failed`), `total_rows`, `headers` (jsonb, the file's column titles), `mapping` (jsonb, column title to resident field), `date_order` (`ymd`, `mdy`, `dmy`; how `05/03/1990` is read, ISO dates always work), `duplicate_action` (`skip` default, `update`), `counts` (jsonb: new, duplicate, error), `result` (jsonb: created, updated, skipped, failed), `committed_at`.

`import_rows` (`ON DELETE CASCADE` from the batch, unique on batch and `row_number`): `row_number` (file row, header is row 1), `raw` and `mapped` (jsonb, **personal data**), `errors` (jsonb list of field and message; messages never contain cell values), `classification` (`new`, `duplicate`, `error`), `duplicate_resident_id`, `duplicate_scope` (`existing` or `file`), `outcome` (`created`, `updated`, `skipped`, `failed`).

Rules as built:
- **Staged personal data is temporary.** `raw` and `mapped` are set to null when the batch is committed, cancelled or left unfinished for 24 hours (`expired`, cleaned when the list or an upload is requested). Row numbers, reasons and outcomes stay.
- **Same rules as the resident API:** every row goes through `ResidentFields`. Sex, civil status, suffix and voter registration are matched ignoring case (plus M/F, widow, widower, widowed, separated). A street must already exist in `streets` (matched ignoring case); an unknown street is a row error, no street is created. Sectors are not imported (Step 14).
- **Required:** `first_name` and `last_name` must be mapped. Each resident field maps to one column only.
- **Duplicates:** same first name, last name (ignoring case) and birthdate as an existing resident, or as an earlier row of the same file. A row with no birthdate is never a duplicate. Duplicates are skipped by default. With `update`, a duplicate of an **active** existing resident gets the file's non-empty values written over its fields (name and birthdate never change, blanks never erase data); archived residents and repeats inside the file are always skipped. An ID number already held by a different resident, or repeated in the file, is a row error.
- **Commit** checks every row again (the preview may be stale), then writes in one transaction: if writing fails nothing is saved and the batch is `failed`. Rows with errors are not imported and are reported (`GET /imports/{id}/errors.csv`: row, field, problem; no values).
- **Limits:** 10 MB, 30000 rows, 60 columns; `.xlsm`, `.xls` and files containing a VBA project are refused; only the first sheet of an `.xlsx` is read.

**API (System Administrator only, `records.import`):** `GET /api/v1/imports/` (history), `POST /api/v1/imports/` (upload; returns the headers, a suggested mapping and sample rows; a mapping used before is suggested first), `GET /{id}`, `PUT /{id}/mapping` (saves mapping, `date_order`, `duplicate_action` and checks every row), `GET /{id}/rows?classification=` (row preview), `POST /{id}/commit`, `GET /{id}/errors.csv`, `DELETE /{id}` (cancel). Audit actions `import.upload`, `import.preview`, `import.commit`, `import.cancel`: file name and counts only.

### Dashboard and report figures (computed on read, nothing stored)

`GET /api/v1/dashboard` (Staff and Admin) and `GET /api/v1/reports/*` (System Administrator, `reports.view`: `summary`, `issuances-by-type`, `issuances-by-purpose`, `expiring`, `account-activity`, `records-overview`). Counts only: no health condition and no resident names in any total. The expiring list names the resident because it is a work list.

- **Period:** `today`, `week` (from Monday), `month`, `quarter`, `3months`, `6months` (calendar months, current month included), `year`, `overall`. Each runs **up to today**, Manila date. The "previous period" is the same span one unit earlier (month so far against the same days of last month); `overall` has none.
- **Issued** means a document in force (`status = 'issued'`) counted by `issue_date`. **Voided** documents are counted separately and never as issued. **Corrections** are issued documents that replace an earlier one; the earlier one becomes voided when the correction is issued.
- **Expiring or expired** looks only at a resident's **latest issued** Barangay Clearance and latest issued Barangay ID (by `issued_at`), so a renewed record is not listed. "Soon" is 30 days for both (`CLEARANCE_EXPIRING_SOON_DAYS`, `ID_EXPIRING_SOON_DAYS`; D-21 is open). The ID counts use the same rule as `GET /barangay-ids`.
- **Not reported yet:** sign-ins (not recorded), masterlist imports (no import yet, D-19), pending registrations (no registration flow, none planned: D-11). The dashboard's "pending document requests" card is `open_drafts`, the number of unissued drafts.

### `id_number_series` (Barangay ID numbering, patch 65)

One settings row (`id = 1`, enforced by a check). Columns: `prefix` (up to 30 characters, may be empty), `include_year`, `digit_width` (0 to 12; 0 means no zero padding), `restart_yearly` (only with `include_year`), `next_number` (1 or more), `counter_year`, `enabled` (default **false**), `updated_at`, `updated_by_user_id`. The migration inserts the row switched off and changes no data. The number is `prefix` + (`YYYY-` when the year is included) + the running number.

Rules while `enabled` is true (while it is false everything works as before, staff type the number):

- A **new card** for a resident with no ID number gets the next series number, taken inside the issue transaction under a row lock (resident row first, then the series row), so two clerks issuing at the same moment get different numbers. Numbers already in use (including look-alikes, archived cards included) are skipped, up to 10,000 tries (409 `id_series_exhausted`); a number longer than 50 characters is refused (409 `id_series_too_long`).
- A resident who **already has** a number keeps it. Renewals and replacements keep it, as before. A **correction** never takes a new number.
- A number typed by hand that differs from the resident's current one needs `id.override` (administrator): otherwise 403 `{code: "id_number_automatic"}` and nothing is reserved. An administrator's override is allowed and recorded. The look-alike check still refuses a number held by another resident.
- With `restart_yearly`, the counter goes back to 1 when the Manila calendar year changes.
- The `issuance.issue` audit row carries `id_number_source` = `series` or `override`.

API: `GET /api/v1/barangay-ids/series/status` (admin and staff; `{enabled, preview}`), `GET` and `PUT /api/v1/barangay-ids/series` (administrator only, permission `id.override`). A change writes the audit action `id_series.update` (module `records`; details: changed field names, `numbering` on or off, `next_number`) and nothing when nothing changed. Saving also sets `counter_year` to the current year.

### `security_answers` (recovery by security questions, patch 69)

Columns: `user_id` (FK `user.id`, ON DELETE CASCADE), `question_id` (`q01` to `q10`, 8 characters), `answer_hash` (Argon2 of `"<question_id>:<normalised answer>"`), `updated_at`; primary key (`user_id`, `question_id`). A person has either 0 rows (not set) or exactly 3. Saving replaces the old rows. Migration `b5d2f8a6c391`; no data change. The question wording lives in the language files (`securityQuestions.catalog`), the ids are fixed in `backend/app/core/security_questions.py` and `frontend/src/lib/securityQuestions.ts`.

API: `GET` and `PUT /api/v1/users/me/security-questions` (own account; `PUT` needs `current_password`, exactly 3 different ids, 3 different answers); `GET` and `DELETE /api/v1/users/{id}/security-questions` (administrator only; `{configured}`; not for yourself); signed out: `POST /api/v1/password-recovery/questions` and `POST /api/v1/password-recovery/reset`. Settings: `RECOVERY_QUESTIONS_MAX_FAILED_ATTEMPTS` (5), `RECOVERY_QUESTIONS_LOCKOUT_MINUTES` (30), `RECOVERY_QUESTIONS_MAX_FAILED_ATTEMPTS_PER_IP` (30); the counters reuse the `PasswordRecoveryRateLimit` buckets (kinds `questions-email` and `questions-ip`). Audit actions: `auth.recovery_questions_set`, `auth.recovery_failed`, `auth.recovery_success`, `auth.recovery_reset_by_admin`.

### Not designed yet (waiting on the client)

- **Family, beneficiary and sector-detail fields (D-20):** no table until the client says which fields they need. Sector membership itself already exists (`resident_sectors`); the Family & Sector tab reads it through `GET /api/v1/residents/sector-summary` (active residents per sector, no new table).
- **Masterlist import (D-19):** an `import_batches` table will be added after the column mapping is agreed.
- **Dashboard and reports (D-21):** computed from `issuances` and the latest ID per resident, so they need no tables.

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
| Residency "Additional statement" | `additionalStatement` | `issuances.additional_statement` | text, up to 500 characters; one nullable column, not a detail table (patch 68); accepted on a Residency only (422 otherwise); not sent on update = unchanged, sent blank = cleared; kept by a correction; not printed yet (Residency has no print template) | optional |
| Signatory | `signatoryOfficialId` | `signatory_official_id` | FK `officials` (null when pre-printed) | select, defaulted per document |
| (Issue / Save draft) | `status` | `status` | enum `draft`, `issued`, `voided` | button |
| (auto) | — | `issued_by_user_id` | FK `user`, `ON DELETE RESTRICT` (decision 7) | session |
| (auto) | — | `issued_at`, `created_at` | timestamptz | system |
| (auto) | — | `expires_on` | date, null unless an approved rule exists (Clearance: 2 months, First-Time Jobseeker: 1 year) | derived from `document_types.validity_months` |
| Correction flow | — | `corrects_issuance_id`, `correction_reason` | FK self, text | system |
| Void flow | — | `void_reason` | text, admin only | system |

### `issuance_identification` (1:1, only Clearance, Franchise, Electrical/Water, Building, optional on Residency)

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Valid ID presented | `identification.idTypeId` | `id_type_id` | FK `id_types` (includes CTC) |
| ID number | `identification.idNumber` | `id_number` | text, required |
| Place of issue | `identification.placeOfIssue` | `place_of_issue` | text, default `Los Baños, Laguna` |
| Date of issue | `identification.dateOfIssue` | `date_of_issue` | date, default today |

### `issuance_payments` (1:1, same documents as above)

Source: the stamp box and receipt cells of the office's current *Clearance Issuing* workbook.

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Free of charge | `payment.isFree` | `is_free` | bool |
| Official receipt no. | `payment.officialReceiptNo` | `official_receipt_no` | text; `FOC` when free; unique per non-free receipt |
| Date of payment | `payment.dateOfPayment` | `date_of_payment` | date, default today. Printed in the "DOCUMENTARY STAMP TAX PAID" box. Shown for Clearance, Franchise and Electrical/Water only; not in the future |
| Certified by (initials) | `payment.certifiedBy` | `certified_by` | text, optional. Printed in the same stamp box. Same documents as above |

### `issuance_sectors` (N:1 to `issuances`, Indigency 1–2, Assistance 1, Marginalized 1)

| Form input | Form key | Column | Rule |
|---|---|---|---|
| Sector | `sectors[].sectorId` | `sector_id` | FK `sectors` |
| Sector ID number | `sectors[].idNumber` | `sector_id_number` | text, optional (Marginalized Sector) |

### `issuance_resident_snapshot` (1:1, written only when `issued`)

`full_name`, `address_line`, `birth_date`, `birth_place`, `sex`, `civil_status`, `resident_since_year`, `resident_since_birth`, and for a Barangay ID only `emergency_contact_name`, `emergency_contact_address`, `emergency_contact_phone` (printed on the card back). Copied from the resident at the moment of issue. The photo is **not** snapshotted in Version 1: a reprint uses the resident's current photo (revisit with D-45).

## Document detail tables (1:1 with `issuances`)

| Table | Form input → column |
|---|---|
| `issuance_barangay_clearance` | **No form inputs.** Purpose note (`purpose_note`) and Referred by (c/o) (`referred_by_official_id`) were **removed from the New Issuance form and the print overlay**. Do not recreate the inputs or add the columns back. Remarks stays on the core table |
| `issuance_franchise` | Tricycle association / make / body / motor no. / color / plate no. → **`tricycle_id`** (FK `tricycles`). The form still shows the 6 inputs; on issue the API finds a tricycle by plate or motor number, or creates one, so a tricycle is stored once and reused. `tricycles(association_id, make, body_type, motor_number, color, plate_number)`; unique on plate and on motor number |
| `issuance_utility` | Service → `has_electric`, `has_water` (bools, at least one); Type of connection → `connection_type` (`new` or `reconnection`); Classification → `classification` (`residential` or `commercial`); Location → `location` |
| `issuance_indigency` | Office addressed to → `addressed_to_office`; Requested by → `requested_by` (optional, only when someone other than the resident asked; the old "Damayan" sheet printed "Requested by:"). Sectors and purpose are on the core tables |
| `issuance_building` | Location → `location` (default `Barangay Mayondon`). Identification and payment use the shared tables. **Open:** the sheet has a few unlabeled check marks that are not captured yet |
| `issuance_philhealth` | **Removed.** PhilHealth Certification is no longer a document type, so this table is not needed |
| `issuance_assistance` | Assistance requested → `assistance_type` (`financial`, `medical`, `burial`); For → `for_self` (bool); Name → `beneficiary_name`; Relationship → `beneficiary_relationship` (both required when `for_self` is false) |
| `issuance_marginalized_sector` | Health condition → `health_condition`. **Sensitive:** masked as `[restricted]` in every list, returned only by the single-issuance endpoint, and each read is audited (decision 3) |
| `issuance_first_time_jobseeker` | Educational attainment → `educational_attainment`; Course → `course` (default `N/A`); JobStart beneficiary → `is_jobstart_beneficiary` (bool); Witness → `witness_official_id` (FK `officials`). "Parts to print" is a print-time choice and is **not stored**. Rule: one issued row per resident, enforced with a partial unique index on `(resident_id)` where `status = 'issued'` |
| `issuance_barangay_id` | Transaction → `transaction_type` (`new`, `renewal`, `replacement`); Valid until → `valid_until`; `id_number` (the number printed on this card). The number is assigned on issue and also becomes the resident's current number (`residents.id_number`), so each card keeps its own history row (decision 2). **Rules as built:** the clerk types `valid_until` (validity length is open, D-18) and, for a new card, the number (series is open, D-43); a renewal or replacement keeps the resident's current number unless another is typed. `new` is refused when the resident already has a card or a number on record; `renewal` and `replacement` need one of them. A number held by another resident is refused. `expires_on` is set to `valid_until`. Issue needs birthdate, birth place, civil status, sex, the address trio, the three emergency contact fields and a photo on the resident record. A voided card leaves `residents.id_number` unchanged |

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
| ID | photo (`resident_photos`), `emergency_contact_name`, `emergency_contact_address`, `emergency_contact_phone` |

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
| Civil status | `civilStatus` | `civil_status` | one of the four allowed values (`CHECK`, decision 8) |
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

Suggestion lists seeded from the office's workbook: Barangay Clearance purposes (30), Certificate of Indigency purposes (9), offices addressed to (7, no names of elected officials because they change) and ID types (now includes `PRC ID`). Purposes typed by staff are remembered once a document is issued; offices are not yet.

`document_types(code, name, category, print_mode, validity_months, one_per_resident, signatory_default_position)` · `issuance_purposes` · `sectors` · `id_types` · `officials` (defined above) · `tricycle_associations` · `streets`.

`document_types` mirrors `documentConfig.ts`. Seeding it from that file keeps the form and the database in sync.

## Suggested indexes and constraints

- `issuances(resident_id, document_type_id, status)` for the one-per-resident check and the resident history.
- `issuances(issue_date)` and `issuances(reference_no)` for the list page search.
- Check: `status = 'issued'` implies `issued_at` and `issued_by_user_id` not null.
- Check: `issuance_payments.is_free = true` implies `official_receipt_no = 'FOC'`.
- Resident indexes and the duplicate warning are listed under `residents`; `audit_log` also gets an index on `(record_type, record_id)` and on `occurred_at`.
