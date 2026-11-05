# 04 · Documents and Printing

Which documents the system produces, the fields each needs, and how printing onto the barangay's **pre-printed forms** must work. Combines the former Document Template Field Matrix and the hard-copy form specifications from the design draft.

**Status:** working design reference based on the shared templates and hard-copy specifications. **Not client approval.** Use synthetic data only. Do not copy real rows, names, addresses, ID numbers or incident narratives from the source workbooks and documents into the repository. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 5, 2026

## 1. Source files and what they inform

| File (client-supplied, not in repo) | Informs |
|---|---|
| `Barangay ID Layout.pub` | Existing ID front/back layout |
| `Certification.xlsx`, `Clearance Issuing.xls` | Current issuance workflow and possible tracking fields. Do not import real rows into sample data |
| `Barangay Clearance.docx` and the other blank form copies | Blank copies are kept in [`reference/document-templates/`](reference/document-templates/README.md). Blank forms only, no real data |
| `Residency.docx` | Residency certification wording. May contain sensitive narratives; do not reuse as defaults |
| `First-Time Jobseekers.docx` | Applicant information sheet, oath of undertaking and barangay certification. Use the structure only |

The supplied workbook has **different purpose lists on different sheets**. The prototype uses the `BRGY CLEARANCE` list for Barangay Clearance. The `CLEARANCE POSTAL` list is not mapped to any form yet. Only those two sheets were confirmed to have active Excel dropdown validation. Check option lists against the original workbook and confirm with the barangay **(D-14)**.

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
| Certification of Marginalized Sector | `Barangay_Certification_of_Marginalized_Sector.docx` | `marginalized` |
| Certification for assistance request | Page 2 of `Barangay_Certification_of_Marginalized_Sector.docx` | `assistance` |

The Issuances page has a **Printing setup** screen for selecting a template, saving per-template X/Y calibration offsets, printing a calibration sheet and resetting offsets. Offsets are stored in browser local storage. The default positions are estimates and still require visual comparison and real-paper calibration.

The following documents have **no print template** yet: Residency, First-Time Jobseekers, PhilHealth, Barangay ID front and Barangay ID back. Confirm the intended output and approved source format before adding templates.

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
7. Approved purposes, sector options, ID types, receipt values, default notes and "addressed to" wording.
8. Exact name and fields of the assistance certification — is it the Damayan form? **(D-13)**
9. Where does the birthdate come from, and is the photo captured, uploaded or taken from an existing resident record? **(D-18)**
10. Physical samples of both ID sides and the assistance certification for calibration.
11. Account permissions — the brief and the proposed Admin/Staff prototype differ **(D-10)**.

## 9. Milestone alignment

- **Week 14, ITST301:** validate field groups and workflows before finalizing mockups.
- **Week 15, Integrative Programming:** use the approved matrix for data models and validation.
- **Week 15, Client-Server Technologies:** keep templates and generation resources local.
- **Week 16, Networking 2:** test LAN access, printing, backup/recovery and offline behavior at the client site.
