# Admin Portal Draft

Status: **Draft only. Not approved for production or client handover.**

Base branch: `Foundation`

Working branch: `draft/admin-portal`

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

The initial document types shown in the draft are Barangay ID, Barangay Clearance, Barangay Clearance for Electrical and Water Connection, Barangay Franchise Clearance, Certificate of Indigency, Certificate of Residency, and Other Certificate. Confirm the official names and workflows with the client.

## Important limitations

- Dashboard figures, issuance history, names, and activity items are fictional sample data.
- Dashboard charts are illustrative, not connected to live statistics.
- Records and Officials pages display sample rows only. They do not create, update, or delete database records.
- Issuance form inputs are local draft inputs only. They do not issue or generate official documents.
- Barangay Information, Document Templates, and Audit Logs in System Settings are visual placeholders.
- Account profile, password change, and account management continue to use the existing foundation functionality.
- The interface presents a single Admin role. New accounts created through the draft interface are submitted as Admin. The backend still uses its existing `is_superuser` authorization field, so confirm that account authorization is consistent before any deployment.
- Terms of Use and Privacy Policy in the footer are placeholders, not approved legal documents.
- No real resident or barangay data should be entered into this draft.

## Review before any merge

1. Confirm the system scope and document workflows with the client.
2. Confirm dashboard metrics, reporting periods, demographics categories, and historical data availability.
3. Review mobile and desktop layouts with the client.
4. Test the frontend build and regression tests locally.
5. Confirm role and authorization behavior in the backend.
6. Replace fictional sample data only after an approved data plan exists.
7. Keep this branch separate from `Foundation` until the team and client review the draft.
