# 04 · Documents and Printing

Which documents the system produces, the fields each needs, and how printing onto the barangay's **pre-printed forms** must work. Combines the former Document Template Field Matrix and the hard-copy form specifications from the design draft.

**Status:** working design reference based on the shared templates and hard-copy specifications. **Not client approval.** Use synthetic data only. Do not copy real rows, names, addresses, ID numbers or incident narratives from the source workbooks and documents into the repository. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 5, 2026

## 1. Source files and what they inform

| File (client-supplied, not in repo) | Informs |
|---|---|
| `Barangay ID Layout.pub` | Existing ID front/back layout |
| `Certification.xlsx`, `Clearance Issuing.xls` | Current issuance workflow and possible tracking fields. Do not import real rows into sample data |
| `Barangay Clearance.docx` and the other form copies | Kept in `docs/Barangay-softcopies/` on `master`. Treat them as read-only originals. `Barangay-Certification-of-Residency.docx` and `Barangay-Certification-of-Marginalized-Sector.docx` hold real people's names on pages after the blank sheet: only the blank pages may be used, and the files should be replaced by blank-only copies |
| `Residency.docx` | Residency certification wording. May contain sensitive narratives; do not reuse as defaults |
| `First-Time Jobseekers.docx` | Applicant information sheet, oath of undertaking and barangay certification. Use the structure only |

The supplied workbook has **different purpose lists on different sheets**. Those lists remain the source material to review with the barangay **(D-14)**. In the current application, the administrator-maintained `IssuancePurpose` list is shared by Clearance and Indigency; Residency hides the three assistance-purpose names in `residencyExcludedPurposes`. This shared-list behavior is an implementation choice, not confirmation that the barangay approved merging the workbook's separate lists. The `CLEARANCE POSTAL` list still needs an explicit mapping decision.

## 2. Document list

The brief lists documents "discussed or shown" and says to **confirm the final list and exact approved formats; do not add documents merely because a sample exists**. The team later decided that Damayan and other client-provided forms are part of the *design* scope, kept as provisional until confirmed **(D-13)**.

| # | Document | Source | Print mode | Status |
|---|---|---|---|---|
| 1 | Barangay Clearance | Client hard copy | Overlay on pre-printed form | In brief |
| 2 | Certificate of Indigency | Client hard copy | Overlay | In brief (barangay's own) |
| 3 | Clearance — Electrical and Water Connection | Client hard copy | Overlay (specific paper variant with a different letterhead email) | In brief |
| 4 | Barangay Franchise Clearance (tricycle) | Client hard copy | Overlay | In brief |
| 5 | Certification for assistance request (likely Damayan; exact name unconfirmed) | Client form | Overlay on its own layout | Provisional |
| 6 | Barangay ID — front | Publisher layout | Overlay on ID card stock | In brief |
| 7 | Barangay ID — back | Publisher layout | Overlay | In brief |
| 8 | Residency certification | Word file | **Unknown**: full document or overlay? | Provisional (D-15) |
| 9 | First-Time Jobseekers packet | Word file | **Unknown** | Provisional (D-16) |

Business and building clearances (municipal), and BIR/PhilHealth documents, remain **excluded** unless the client corrects that understanding.

## 3. Printing rule (applies to every form)

The system prints **typed values only** onto the client's existing pre-printed paper. The print output is a **transparent field overlay, not a redesigned document.** It must **not** recreate or print:

- letterhead, logos or watermark
- document title and fixed paragraphs
- pre-printed field labels and colons
- the signatory's existing signature
- the DRY SEAL label
- the footer

Staff apply the dry seal; residents complete thumbmark and signature areas by hand. Official signatures and dry seals are never created or applied by the system.

Browser print must use **actual size / 100% scaling** with headers and footers disabled.

### 3.1 Print mode: data only or form and data (added November 10, 2026)

The Print button on an issued History row prints in one of two modes; the arrow next to it chooses, and the choice is remembered in the browser (`print-mode`).

- **Data only (pre-printed paper)**: the rule above. This is the default.
- **Form and data (blank paper)**: the form is typeset on one Letter page with the letterhead, a faint logo watermark, the labels and lines, and the typed values. The wording is copied from the Word files in `docs/Barangay-softcopies/`. Signatures, the thumbmark and the dry seal are still never created: the thumbmark box and the "DRY SEAL" caption are only markers for staff.

**Form and data uses the barangay's own form (patch 105).** The page is the image of the barangay's blank Word file (`docs/Barangay-softcopies/`), exported to PDF by Word itself and turned into page images by `scripts/build-print-forms.py` (`public/assets/print-forms/`, listed in `src/lib/print/formBackgrounds.ts`). The typed values go on top at the same positions as in data-only mode, so the two modes print the same sheet. The form is never retyped or redrawn: if the barangay changes a Word file, export it again and run the script. A form with no image yet still prints from the typeset copy in `PrintForm.tsx`; that copy is a stopgap, not the template. Only blank forms may be used (no resident data on any page).

**The first set of page images (patch 106) was made with LibreOffice, not Word.** Word was not available, so the Word files were converted with LibreOffice. LibreOffice has no metric-compatible Arial Narrow and substitutes Cambria, so each form first overflowed to a second page. To get one page per form, a throwaway copy of each file (the original is never touched) had the blank paragraphs just above the ID block removed until LibreOffice gave one page. Consequences: the top of each form (letterhead, title, name and address rows, boxes, photo box) is where the barangay file puts it, but the bottom block (ID, number, place, date, receipt number) sits roughly 16 to 80 pt higher than in Word, and fonts differ slightly. Marginalized Sector and Assistance are pages 1 and 2 of the unmodified LibreOffice PDF. Residency and First-Time Jobseekers have no image and no overlay template. The typed values were then aligned to the pre-printed labels and rules in the images (baselines within about 1 pt on screen; the `prefix` of the Indigency "Addressed to the office of:" row exists because the barangay file does not pre-print those words). **For the best match with paper, export the five forms from Word itself** (File, Save as PDF; for Marginalized keep only pages 1 and 2, which are blank), run `python3 scripts/build-print-forms.py <folder>`, then re-check each coordinate in `src/lib/print/templates.ts` with `--words <id>`, because the bottom blocks will move back to where Word puts them. A paper test on the real printer (section 7) is still required before anyone relies on it.

Both modes cover the six types that have a print template. Reprint is no longer in the three-dot menu. The typeset forms have not been compared with paper by the client; confirm the letterhead e-mail addresses, the motto spelling and the signatory names on them before relying on blank-paper printing.

**Paper sizes (owner decision, Nov 18, 2026).** Short paper is Letter, 8.5 x 11 in: Barangay Clearance, Franchise Clearance, Electrical and Water, Residency, Indigency, Assistance Certification (which now also covers the former Marginalized Sector certificate). Long paper is 8.5 x 13 in: First-Time Jobseeker. Long here is the Philippine long bond, not US Legal (8.5 x 14 in); if the office stock is 8.5 x 14 in, change `paperDimensions.long` in `frontend/src/lib/print/paperSizes.ts` (the only place that decides it). The page size is set per document (`paper.size` in `documentMeta`) and per print template (`paperSize` in `templates.ts`); the print CSS `@page` rule, the on-screen page box, the form image and the calibration sheet all read it. Every print template that exists today is Short. Residency and First-Time Jobseeker still have no print template, so no Long page can print yet; when the Jobseeker layout is added, give it `paperSize: "long"`, and its form image must be 612 x 936 pt. The Long size has not been tried on the EPSON L3250: the printer must be set to the matching 8.5 x 13 in paper size (a user-defined size in the driver if the list lacks it), at 100% scale, with the paper tray set accordingly.

## 4. Form-by-form typed content

### 4.1 Barangay Clearance
- Date at top right, above the pre-printed Date line
- Name, address, **age calculated from birthdate**, birthdate, birthplace, civil status
- Purpose and remarks. The purpose note and the "c/o" second remarks line were removed from the New Issuance form and from the print overlay.
- Resident photo in the designated box on the right (if approved)
- Bottom fields: valid ID presented, ID number, place of issue, date of issue, official receipt number
- Do **not** print in the right thumbmark box or the resident signature line
- Pre-printed and not printed: two-month validity statement, Punong Barangay signature, watermark, letterhead, labels, footer

### 4.2 Certificate of Indigency
- Date, name, address, age, sector (one or two sector names), purpose, and `Addressed to the office of [office]`
- The **`SECTOR :` label is not pre-printed** and must be included in the typed overlay
- Punong Barangay signature and everything else stays pre-printed

### 4.3 Clearance — Electrical and Water Connection
- Date; check marks for **Electric** and/or **Water**; name; address
- One choice of **New / Reconnection** and one of **Residential / Commercial**
- Location, CTC number, place of issue, date of issue, official receipt number
- Use the specific paper variant with the different letterhead email; never print a letterhead

### 4.4 Barangay Franchise Clearance (tricycle)
- Date, name, address, tricycle association
- Indented vehicle block: make, type of body, motor number, color, plate number
- Bottom fields: CTC number, place of issue, date of issue, official receipt number

### 4.5 Certification for assistance request (likely Damayan)
- Separate layout, **not** a clearance layout. Logo pre-printed top left; no watermark; no DRY SEAL label
- Print directly on the underlines or inside parentheses: name after Mr./Ms.; address after "resident of"; years/months of residency; sector; **one** assistance choice (financial, medical or burial); **one** recipient choice (oneself or a relationship); name under which assistance is requested; day, month and year in the "Given this" line
- Signatory is a **Barangay Kagawad** (clearances are signed by the Punong Barangay)

### 4.6 Barangay ID — front
- Print only: the remaining ID number after the pre-printed `ID No. 18-128-3597-` prefix; full name and address inside the light-blue block above the pre-printed `MAYONDON, LOS BAÑOS, LAGUNA` line; the resident photo in the photo box
- Not printed: logo, heading, number prefix, blue block, motto/footer

### 4.7 Barangay ID — back
- Print: birthdate, birthplace, sex, civil status, valid-until date, emergency contact name, emergency contact address, emergency contact number
- Not printed: labels, red emergency-contact heading, signatures, countersignature, blue footer band, warning text

### 4.8 Residency certification (provisional)
The Word file shows wording varies by purpose. Do not hard-code example narratives or incident details. Confirm approved default wording, editable text, purpose options and required issuance metadata. Blotter management stays out of scope unless separately approved **(D-15)**.

### 4.9 First-Time Jobseekers (provisional)
The file holds an applicant information sheet, oath of undertaking and barangay certification. Applicant sheet fields: name, birthdate, age, complete address, years/months of residency, sex/gender, civil status, educational attainment, course (if applicable), JobStart beneficiary yes/no. Confirm which parts the system generates, which data comes from the resident record, how residency duration is supplied, and who witnesses the oath. **Do not infer legal eligibility or auto-approve a request** **(D-16)**.

## 5. Issuance metadata

Document type, purpose, issue date, resident reference, unique issuance reference, ID/CTC presented where applicable, official receipt number (or a non-applicable value), issuing staff account, status, correction reason where required, and expiry date **only where an approved rule exists**. Not every field applies to every document **(D-14)**.

## 6. Prototype behavior and printing (current)

Printing is implemented as a transparent typed-value overlay on the matching pre-printed paper. The system does not print the form's fixed text, labels, logos, watermarks, signatures, dry-seal labels or footers. Thumbmark and resident-signature areas remain blank. Use synthetic data for development and demonstrations.

Six print templates are currently defined in `frontend/src/lib/print/templates.ts`:

| Template | Source form | Print template |
|---|---|---|
| Barangay Clearance | `Barangay_Clearance.docx` | `clearance` |
| Barangay Franchise Clearance | `Barangay_Franchise_Clearance.docx` | `franchise` |
| Clearance — Electrical and Water Connection | `Barangay_Clearance_Electrical_and_Water.docx` | `utility` |
| Certificate of Indigency | `Barangay_Certification_of_Indigency.docx` | `indigency` |
| Certification for assistance request (also replaces the retired Marginalized Sector / Pagpapatunay certificate; the health condition is never printed) | Page 2 of `Barangay_Certification_of_Marginalized_Sector.docx` | `assistance` |

The Issuances page has an **Issuance settings** button (patch 142) that opens a pop-up; its **Printing setup** tab is a screen for selecting a template, saving per-template X/Y calibration offsets, printing a calibration sheet and resetting offsets. Offsets are stored in browser local storage. The default positions are estimates and still require visual comparison and real-paper calibration.

The following documents have **no print template** yet: Residency, First-Time Jobseekers, Barangay ID front and Barangay ID back. (PhilHealth Certification was removed from the app entirely; it is no longer a document type.) Confirm the intended output and approved source format before adding templates.

Required fields and validation rules remain **unconfirmed**. Do not treat the presence of a source form as client approval.

## 7. Print-template requirements

- One **separate template per form**: clearances, the assistance certification, ID front and ID back must not share a generic print page. (Seven overlay layouts: four clearance-type forms, the assistance certification, ID front, ID back.)
- Store field positions and photo boxes as **template-specific configuration**, preferably relative to the confirmed paper dimensions. Current prototype positions are not calibrated.
- Print typed text only: no logos, labels, captions, signature images, borders, footers or decoration.
- Leave thumbmark and resident-signature areas blank. Leave signatory areas blank so the pre-printed signature shows.
- Compute age from birthdate; define behavior for a missing or invalid birthdate.
- For choice fields, print the mark only inside the matching box or parentheses. Never print both options when one is selected.
- Photos: client-approved size and placement; aspect ratio per client preference.
- Provide a **calibration mode or checklist** using plain test paper before official stock. Verify all seven templates against actual paper.
- Test that the printer does not scale, crop or shift the overlay. Record printer model, paper size, orientation, scaling setting and approved template revision.
- Keep templates and generation resources **local** so printing works offline.
- Do not print from a generic preview. Keep real resident records and sensitive source files out of the repository and demos.

## 8. Questions for the client

1. Should Residency and First-Time Jobseekers print as complete documents on blank paper, or as overlays on pre-printed stock? **(D-15, D-16)**
2. Which parts of the First-Time Jobseekers packet should be generated: applicant sheet, oath, certification, or all three?
3. Which residency wording is approved, and may staff edit the narrative?
4. Is residency duration entered manually or calculated from an approved start date?
5. Which fields are mandatory for each document? **(D-14)**
6. Dimensions, orientation, printer models and photo dimensions for each template. Does every workstation use the same printer settings? **(D-17)**
7. Approved purposes, sector options, ID types (the Valid ID and Sector lists are editable by an administrator in Issuance settings since patches 142 and 143; the New Issuance form holds the real id of the chosen ID type and sector, not their place in a list, and the print code finds names by id, so a removed list item cannot shift another item's name onto a printed document), receipt values, default notes and "addressed to" wording.
8. Exact name and fields of the assistance certification — is it the Damayan form? **(D-13)**
9. Where does the birthdate come from, and is the photo captured, uploaded or taken from an existing resident record? **(D-18)**
10. Physical samples of both ID sides and the assistance certification for calibration.
11. Account permissions — the brief and the proposed Admin/Staff prototype differ **(D-10)**.

## 9. Milestone alignment

- **Week 14, ITST301:** validate field groups and workflows before finalizing mockups.
- **Week 15, Integrative Programming:** use the approved matrix for data models and validation.
- **Week 15, Client-Server Technologies:** keep templates and generation resources local.
- **Week 16, Networking 2:** test LAN access, printing, backup/recovery and offline behavior at the client site.
