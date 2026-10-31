# Document Template Field Matrix

Updated: October 27, 2026  
Branch: `draft/admin-portal`

This is a working design reference based on the shared templates and the written hard-copy specifications. It is not client approval. Use synthetic data only. Do not copy real rows, names, addresses, ID numbers, or incident narratives from the source workbooks and documents into the repository.

## Source files and what they inform

- `Barangay ID Layout.pub`: reference for the existing ID front/back layout.
- `Certification.xlsx` and `Clearance Issuing.xls`: reference for current issuance workflow and possible tracking fields. Do not import their real rows into sample data.
- `Residency.docx`: reference for residency certification wording. Examples may contain sensitive narratives, so do not reuse them as defaults.
- `First-Time Jobseekers.docx`: contains an applicant information sheet, oath of undertaking, and barangay certification. Use the form structure only, not example records.

## Candidate field groups

### Barangay Clearance
Resident, issue date, name, address, birthdate, birthplace, age, civil status, purpose, optional second-line purpose note, remarks, optional second remarks line, valid ID presented, ID number, place/date of ID issue, official receipt number, resident photo if approved.

### Certificate of Indigency
Resident, issue date, name, address, age, one or two sector names, purpose, and office addressed. The typed overlay must include the extra `SECTOR :` label because the client stated it is not pre-printed.

### Electrical and Water Connection Clearance
Issue date, Electric and/or Water selection, resident, address, New or Reconnection, Residential or Commercial, location, CTC number, place/date of issue, official receipt number. Print only the selection marks, not duplicate option labels.

### Barangay Franchise Clearance
Issue date, resident, address, tricycle association, vehicle make, type of body, motor number, color, plate number, CTC number, place/date of issue, official receipt number.

### Assistance request certification
Name and honorific placement, address, years/months of residency, sector, assistance type (financial, medical, or burial), recipient choice (applicant or relationship), name under which assistance is requested, and issue day/month/year. Exact form name remains to be confirmed. Client described a Barangay Kagawad as signatory.

### Residency certification
The Word file shows that certification wording can vary by purpose. Do not hard-code example narratives or incident details. Confirm approved default wording, editable text, purpose options, and required issuance metadata with the client. Blotter management remains out of scope unless separately approved.

### First-Time Jobseekers
The supplied file contains an applicant information sheet, oath of undertaking, and certification. Applicant sheet fields include name, birthdate, age, complete address, years/months of residency, sex/gender, civil status, educational attainment, course when applicable, and JobStart beneficiary yes/no. Confirm which parts the system should generate, which data should come from the resident record, how residency duration is supplied, and who witnesses the oath. Do not infer legal eligibility or automatically approve a request.

### Barangay ID front
Remaining number suffix after the pre-printed `18-128-3597-` prefix, resident full name, address, and photo.

### Barangay ID back
Birthdate, birthplace, sex, civil status, valid-until date, emergency contact name, address, and contact number.

## Issuance metadata to confirm
Document type, purpose, issue date, resident reference, unique issuance reference, ID/CTC presented where applicable, official receipt number or non-applicable value, issuing staff account, status, correction reason where required, and expiry date only where an approved rule exists. Not every field applies to every document.

## Print guardrails
- Printing remains paused until actual paper/card dimensions, orientation, printer models, scaling, margins, and field positions are confirmed.
- Each approved form needs a separate print layout.
- Do not duplicate pre-printed logos, letterheads, watermarks, titles, fixed paragraphs, field labels, signatures, dry-seal labels, or footers.
- Leave resident signature/thumbmark spaces and existing signatory signature areas blank.
- Do not print from a generic preview.
- Use plain-paper alignment tests before official stock.
- Keep real resident records and sensitive source files out of the repository and demos.

## Questions for the client
1. Should the Residency and First-Time Jobseekers Word files print as complete documents on blank paper, or as variable-data overlays on pre-printed stock?
2. Which exact parts of the First-Time Jobseekers packet should the system generate: applicant sheet, oath, certification, or all three?
3. Which residency wording is approved, and may staff edit the certification narrative?
4. Should residency duration be entered manually or calculated from an approved start date?
5. Which fields are mandatory for each document?
6. What are the dimensions, orientation, printer models, and photo dimensions for each template?
7. What purposes, sector options, ID types, receipt values, and default notes are approved?
8. Confirm account permissions because the Creative Brief and proposed Admin/Staff prototype differ.

## Milestone alignment
- **Week 14, ITST301 Principles of Web Design:** validate field groups and workflows before finalizing mockups.
- **Week 15, Integrative Programming:** use the approved matrix for data models and validation.
- **Week 15, Client-Server Technologies:** keep templates and generation resources local for offline use.
- **Week 16, Networking 2:** test LAN access, printing, backup/recovery, and offline behavior at the client site.
