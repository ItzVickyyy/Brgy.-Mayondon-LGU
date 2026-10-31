# Admin Portal Draft

Status: **Draft only. Not approved for production or client handover.**

Base branch: Foundation

Working branch: draft/admin-portal

## Purpose

This branch contains a visual and navigation draft of the proposed Barangay Mayondon LGU Admin Portal. It is intended for internal review and for preparing the Week 14 sitemap, wireframes, and mockups.

The modules and fields are proposals. They must be validated with the barangay before they become final requirements.

## Draft navigation

- Dashboard
- Issuances Management
- Records Management
  - Residents
  - Households
  - Registered Voters
- Officials
- User Management
- System Settings
- Account menu with profile, password, and logout

## Dashboard proposal

- Summary cards: Total Population, Total Households, Registered Voters, Documents Issued
- Document Issuances Over Time with a reporting-period selector
- Issuances by Document Type
- Resident Demographics: By Sex, By Age, By Sector
- Population Growth, pending historical data validation
- Recent Activities, pending logging and data validation

## Issuance Management draft

The current form prototype is limited to the four document types described from the supplied hardcopy list:

1. **Barangay Clearance**
   - Date, Name, Address, Age, Birthdate, Birthplace, Civil Status
   - Purpose, Remarks
   - Valid ID Presented, Number, Place of Issue, Date of Issue
   - Paid under Official Receipt Number
2. **Barangay Franchise Clearance**
   - Date, Name, Address, Tricycle Association
   - Make, Type of Body, Motor Number, Color, Plate Number
   - CTC Number, Place of Issue, Date of Issue
   - Paid under Official Receipt Number
3. **Barangay Clearance (Electrical and Water Connection)**
   - Date
   - Connection Service checkboxes: Electric and Water
   - Name, Address
   - Type of Connection checkboxes: New and Reconnection
   - Classification checkboxes: Residential and Commercial
   - Location
   - CTC Number, Place of Issue, Date of Issue
   - Paid under Official Receipt Number
4. **Certificate of Indigency**
   - Date, Name, Address, Age, Sector, Purpose

Current prototype behavior:
- The selected document type controls which fields appear.
- The Date and Date of Issue fields default to the current local date when a form is opened, when the document type changes, and when Clear Form is used. Birthdate remains blank by default.
- Dropdown selectors are used for Civil Status, Valid ID Presented, and Sector. Clearance Purpose options are based on the supplied BRGY CLEARANCE sheet list. The option lists should be checked against the original workbook and confirmed by the barangay.
- Checkbox groups are used for Electric/Water, New/Reconnection, and Residential/Commercial.
- The form can be cleared.
- A draft can be added to an in-memory history for the current page session.
- The history can be searched and filtered by document type.
- The print action opens a print dialog with a review-only layout, clearly marked as a draft and not an official document.

## Important limitations

- Dashboard figures, issuance history, names, and activity items are fictional sample data.
- Dashboard charts are illustrative, not connected to live statistics.
- Records and Officials pages display sample rows only. They do not create, update, or delete database records.
- Issuance drafts exist only in frontend memory for the current page session. Refreshing the page clears them.
- Issuance forms are not connected to a database or backend API. They do not issue official documents or persist records.
- Print layout is a review prototype, not an approved reproduction of the official hardcopy. Confirm wording, spacing, signatures, seals, fees, and approval steps with the barangay before using it.
- The supplied workbook contains different purpose lists across sheets. The current four-form draft uses the BRGY CLEARANCE purpose list for Barangay Clearance. The separate CLEARANCE POSTAL purpose list is not currently mapped to one of the four forms, so it should be added only after confirming how that sheet relates to the proposed document types.
- Explicit Excel dropdown validation was only confirmed in the converted workbook for CLEARANCE POSTAL and BRGY CLEARANCE. Other workbook option lists were not confirmed as active dropdowns.
- Required fields and validation rules have not been confirmed. The prototype does not assume official eligibility rules.
- The sample history is fictional and must not be mistaken for actual barangay records.
- Barangay Information, Document Templates, and Audit Logs in System Settings are visual placeholders.
- Account profile, password change, and account management continue to use the existing foundation functionality.
- The interface presents a single Admin role. New accounts created through the draft interface are submitted as Admin. The backend still uses its existing is_superuser authorization field, so confirm that account authorization is consistent before any deployment.
- Terms of Use and Privacy Policy in the footer are placeholders, not approved legal documents.
- Do not enter real resident or barangay data into this draft.

## Review before any merge

1. Confirm the system scope and document workflows with the client.
2. Confirm dashboard metrics, reporting periods, demographics categories, and historical data availability.
3. Confirm whether issuance drafts need database persistence, official numbering, editing, cancellation, or deletion.
4. Review the form fields and print layouts with the barangay.
5. Review mobile and desktop layouts with the client.
6. Test the frontend build and regression tests locally.
7. Confirm role and authorization behavior in the backend.
8. Replace fictional sample data only after an approved data plan exists.
9. Keep this branch separate from Foundation until the team and client review the draft.
