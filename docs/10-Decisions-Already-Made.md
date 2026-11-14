# 10 · Decisions Already Made (do not revert)

**For AI assistants and new contributors: read this file first.** These are changes the project owner already made on `draft/admin-portal`. Do not bring back anything listed as removed, and do not "fix" a legacy item unless the owner asks. If you think a decision is wrong, say so and ask; do not change it silently.

Last updated: November 7, 2026. Synthetic data only: never write real names, ID numbers or photos into docs, code or tests.

## Removed or settled

| # | Decision | When | Reason |
|---|---|---|---|
| 1 | New Issuance has **no "Optional extras" accordion, Purpose note, or Referred by (c/o)**. Nothing prints for them. **Remarks stays** (always visible). Residency "Additional statement" and Indigency "Requested by" are inline fields. The Residency statement is now saved (patch 68, one nullable column `issuances.additional_statement`), so the field stays inline as decided. | Round before Records Management | Simplify the popup; the client forms do not need these |
| 2 | **PhilHealth Certification is not a document type.** Removed from the picker, schemas and code. | Same | Documents of other agencies are out of scope ([02](02-Requirements-and-Scope.md)) |
| 3 | **Barangay IDs have no separate page or sidebar item.** They live in Records Management (`/records`, Barangay IDs tab). `/barangay-ids` only redirects to `/records?view=barangay-ids`. | Records Management rounds A-C | One place for resident and ID records |
| 4 | **No "Create Barangay ID" button.** IDs are issued in Issuance Management. ID row Print and Renew open `/issuances?resident=<id>&type=BARANGAY_ID`. | Round B | Avoid two ways to issue an ID |
| 5 | The Residents table shows **only an ID status badge**, not the ID number. Search can still match an ID number. | Round A | Less sensitive data on screen |
| 6 | The developer-style **"ID Validity and Registration" notes box is gone.** The Residents stat card "Residents with Valid ID" replaced the placeholder "ID and Registration Details". | Round C | Notes for developers do not belong in the UI |
| 7 | Dashboard **Quick Actions** sit under Summary Statistics, use the **theme colour only** (stronger tint, border, icon chip), no subtitle, no per-card colours. | Dashboard round | Owner: "highlight, don't change colours" |
| 8 | Blue **text, icons, tints, borders and rings use the `brand` token** (`text-brand`, `bg-brand/10`, `border-brand`, `ring-brand`). **Do not use `text-primary` for text.** `bg-primary text-primary-foreground` is only for solid fills. | Dark/light contrast round | In dark mode the old primary was almost the background colour (1.65:1); brand text is about 8.4:1 |
| 9 | Global tokens changed once: new `--brand`; dark `--primary` raised to `oklch(0.42 0.1 252)`. Do not change tokens again without a measured contrast problem. | Same | See [03](03-Design-and-UI.md) section 5; client approval still open (D-47) |
| 10 | **Management Reports always shows three summary cards** (Documents Issued, Records Expiring, Masterlist Imports) with zero values, not a "No report data yet" message. | Reports round | Consistent layout before data exists |
| 11 | **No sample or example email addresses** in placeholders or seed text (`name@example.com`, `user@example.com` were removed). | Placeholder cleanup | They look like real data |
| 12 | The User Accounts table shows whatever the database holds, including the seeded first admin (`FIRST_SUPERUSER`). That row is deployment data, not code. To replace it: create a real admin, then delete the seed account (the last active admin cannot be deleted). | Same | See [05](05-Roles-Security-and-Privacy.md) A6 |

## Database design (settled Nov 5, 2026)

Full wording and reasons are in [09](09-Issuance-Form-Data-Map.md), *Settled design decisions*. Design decisions by the owner, not client approvals. Do not undo them without asking.

| # | Decision | Reason |
|---|---|---|
| 20 | **Resident photos are stored in the database** (`resident_photos`, `bytea`), with no `photo_url` column and no photo files on disk. | The backup script only dumps PostgreSQL; photos must never leave the host |
| 21 | `residents.id_number` is the current ID number. Each ID card (new, renewal, replacement) is its own issuance row with its own `id_number`. | History is never overwritten |
| 22 | **No "sensitive read" permission.** The health condition is masked in lists, returned only on the single record to `issuance.write`, and each read is audited. | Staff must enter and print it, so a permission they all hold restricts nothing |
| 23 | Business dates are `date` and "today" is computed in `Asia/Manila`, not UTC. Age and ID status are computed, never stored. | The Docker host runs on UTC |
| 24 | An account that issued a document is deactivated, never deleted (`ON DELETE RESTRICT`). `audit_log` is append only. | Keeps issuance history |
| 25 | Sex and civil status are `CHECK`-constrained text. Residents use `suffix`. | Short fixed lists; matches the form contract |
| 26 | `docs/09` is the authority for the schema. The groupmate's SQL script is input, not the schema: its seed lists, one-to-one detail tables and multi-select tables are reused; its cascading deletes, file-path photos, server-date defaults and `r.*` view are not. | One design, built with SQLModel and Alembic, not a second competing schema |
| 27 | The first migration (`b4e8d2a61c37`) removed the template `item` table, cleared stale password-recovery rate-limit rows, and added `document_types`, `sectors`, `id_types`, `issuance_purposes`, `tricycle_associations`, `streets`, `officials` and the append-only `audit_log`. | Foundation for residents and issuance. Lookup values are seeded from office lists; System Administrators can maintain Streets and Tricycle Associations in Records Management. `audit_log` blocks UPDATE, DELETE and TRUNCATE, except clearing `actor_user_id` when an account is deleted |

## Printing

| # | Decision | Reason |
|---|---|---|
| 13 | Printing is **typed values on pre-printed forms only**. Never print letterhead, labels, fixed text, signatures, dry-seal label or footer. | [04](04-Documents-and-Printing.md) section 3 |
| 14 | **Six templates exist:** Clearance, Franchise, Electrical/Water, Indigency, Marginalized Sector (Pagpapatunay), Assistance certification. **Residency, First-Time Jobseekers and Barangay ID have no template.** | [04](04-Documents-and-Printing.md) section 6 |
| 15 | **Records created in the old Issuances form cannot print** (no stored issuance id). Only New Issuance records can. | Print data needs `fields.mockIssuanceId` |
| 16 | Photo: camera capture and "Upload photo", both with local background removal (no external upload). | Resident photos must never leave the computer |

## Legacy code: leave alone unless asked

| # | Item | Note |
|---|---|---|
| 17 | The old Issuances form (`routes/_layout/issuances.tsx`, `components/Issuances/config.ts`, `print-summary.ts`) still contains Purpose note and c/o. | Legacy code the popup replaced. Do **not** copy these fields back into New Issuance. Remove only if the owner asks |
| 18 | The Welcome page and the Activity Log module filter still say "Resident Records" and "Barangay IDs". | Ask before renaming; `tests/welcome.spec.ts` covers the Welcome copy |
| 19 | On `draft/admin-portal`, `docs/reference/document-templates/Barangay_Certification_of_Residency.docx` contains real names (keep this folder off `master`). | Flag to the client; do not edit or delete without being asked |

## Not verified yet (do not claim otherwise)

- Print visibility under print media, a physical printer, and background removal with a real face photo.
- The Clearance bottom block (ID presented, number, place and date of issue, OR number) and the footer lines of Franchise and Electrical/Water are estimates; calibrate with Printing setup.
- The look of the dashboard, popup, Records Management, ID tab and Reports cards in both light and dark mode.
- ID records, residents and the issuance store are separate empty in-memory samples; real data must share resident ids.

Open questions that remain (ID numbering, ID card layout, reprint behaviour, real contact email, approved palette) are D-43 to D-47 in [08-Open-Decisions.md](08-Open-Decisions.md).

## Accounts (decided Nov 7, 2026)

| # | Decision | Date | Reason |
|---|---|---|---|
| 28 | **No staff self-registration.** There is no Request Access, Pending Approval or Pending Registrations page, no sidebar badge and no dashboard card. Only an administrator creates accounts. No account `status` column; `/users/signup` stays disabled (D-11). | Nov 7, 2026 | Owner decision (not a client approval). Matches the brief: no public sign-up |
| 29 | **Offline password reset is an administrator-set temporary password with forced change at next sign-in.** No email, no recovery codes (D-12). | Nov 7, 2026 | Owner decision (not a client approval). Built Nov 7, 2026; changed Nov 10, 2026 (owner): the temporary password is now the fixed default `ChangeThisPassword`, not one the administrator types. Built Nov 7, 2026: the administrator gives the temporary password to the user in person, and every other page and protected API operation is refused until the user changes it. Email cannot work offline |
| 30 | **Barangay ID default validity follows the resident.** Regular (or empty) residents: 12 months. New or renting residents: 6 months until proof of voter registration is verified, then 12. A replacement keeps the validity of the card it replaces unless that card has expired (Claude's default, to be confirmed with the client). Admin and staff may record or clear the proof; both are audited. The rule only sets the default of a new issuance: an ID already issued never changes, the date stays editable and the server only keeps its existing limits. | Nov 13, 2026 | Owner decision for 6 and 12 months (not a client approval); the other points are chosen defaults |
| 31 | **Barangay ID numbers follow one configurable series.** The barangay's own numbering (fixed prefix, then an unpadded running number, no year, no yearly restart) is continued, not replaced: an administrator sets the prefix and the next number once on the Barangay IDs tab; until then automatic numbering is off and clerks type the number. While on, staff cannot type a number; only an administrator can, and it is recorded. A resident keeps the number they already have, including at renewal and replacement. The setting reuses the `id.override` permission. | Nov 13, 2026 | Owner decision to keep the existing series and assign the next number automatically (version 46); renewals-keep-the-number and the starting number are chosen defaults until the barangay confirms them |
| 32 | **Two-factor sign-in is optional, uses an authenticator app (TOTP), and has its own key.** Nobody is forced at sign-in (see decision 34 for who is asked); the server must hold `MFA_ENCRYPTION_KEY` before anyone can turn it on. A staff member who lost the phone is reset by an administrator in Edit User; an administrator is reset only from the server computer with `account_recovery_cli`. Two-factor is still asked after a recovery by security questions. Recovery codes are ten, one-time, shown once and stored as hashes. | Nov 13, 2026 | Owner accepted the defaults of the step 13 and 14 proposal; offline use rules out SMS or e-mail codes |
| 33 | **The notification bell is fed by the audit log, shared across computers and filtered by role.** It replaces the browser-local list of patches 72 and 73 (which lived in `localStorage`, was per browser and could not be shared). Administrators see every notice in the catalog (accounts, security, backups, imports, configuration); staff see only notices about their own account. Residents and issuances stay out (they are in the Activity Log). Read state is per person in the database. **"Clear all" was removed** because audit rows are protected and cannot be deleted: only "mark as read" and "mark all as read" exist. Toasts are separate and are not stored anywhere. Theme and language changes give no toast. Server or database availability notices are not built (an offline server cannot send one). | Nov 14, 2026 | Owner's design of Nov 14; visibility and the removal of "Clear all" are Claude's recommendations, not overruled |
| 34 | **Two-factor is asked of administrators and of staff an administrator picks, but never blocks a sign-in.** A banner under the header (no "Not now") asks every administrator, and every staff member an administrator marked in Edit User ("Ask to use it"), until two-factor is on. It is a request: the person still sets it up on their own phone (the secret never goes to the administrator), and a wrong phone clock cannot lock the only administrator out. While a staff member is asked, they cannot turn two-factor off; an administrator's reset or the server command does not clear the request, so the person is asked again. Administrators cannot be marked (they are always asked). Replaces the lost first version of patch 71 (its column was removed by migration `f1a9c3d7e5b2`). | Nov 14, 2026 | Owner chose the banner for administrators (version 59); "ask" instead of "switch on for staff" is Claude's choice because the secret must reach the person's own phone |
