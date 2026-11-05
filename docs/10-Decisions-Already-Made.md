# 10 · Decisions Already Made (do not revert)

**For AI assistants and new contributors: read this file first.** These are changes the project owner already made on `draft/admin-portal`. Do not bring back anything listed as removed, and do not "fix" a legacy item unless the owner asks. If you think a decision is wrong, say so and ask; do not change it silently.

Last updated: November 5, 2026. Synthetic data only: never write real names, ID numbers or photos into docs, code or tests.

## Removed or settled

| # | Decision | When | Reason |
|---|---|---|---|
| 1 | New Issuance has **no "Optional extras" accordion, Purpose note, or Referred by (c/o)**. Nothing prints for them. **Remarks stays** (always visible). Residency "Additional statement" and Indigency "Requested by" are inline fields. | Round before Records Management | Simplify the popup; the client forms do not need these |
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
| 19 | `docs/reference/document-templates/Barangay_Certification_of_Residency.docx` contains real names. | Flag to the client; do not edit or delete without being asked |

## Not verified yet (do not claim otherwise)

- Print visibility under print media, a physical printer, and background removal with a real face photo.
- The Clearance bottom block (ID presented, number, place and date of issue, OR number) and the footer lines of Franchise and Electrical/Water are estimates; calibrate with Printing setup.
- The look of the dashboard, popup, Records Management, ID tab and Reports cards in both light and dark mode.
- ID records, residents and the issuance store are separate empty in-memory samples; real data must share resident ids.

Open questions that remain (ID numbering, ID card layout, reprint behaviour, real contact email, approved palette) are D-43 to D-47 in [08-Open-Decisions.md](08-Open-Decisions.md).
