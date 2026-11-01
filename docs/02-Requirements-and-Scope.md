# 02 · Requirements and Scope

The client's problem, goals, scope, features and requirements. Combines the final Creative Brief with the requirements and decision log that used to live in the System Specification.

**Status:** The Creative Brief was signed by the professor and is the **approved planning baseline**. Client sign-off of the brief and of the local-network architecture is not recorded **(D-02)**. Anything marked *Proposed* below is **not** a client requirement yet. Undecided items are tagged `(D-xx)` and listed in [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 1, 2026 (reflects the revised brief supplied October 27, 2026)

## 1. Status labels (use consistently)

- **Proposed** — an idea or question to discuss. Not approved.
- **Confirmed** — the client explicitly confirmed it. Record who and when.
- **Approved** — included in a client-reviewed document or the signed Creative Brief.
- **Deferred** — discuss later.
- **Rejected** — decided against; record the reason and decision owner.
- **Pending verification** — implemented or planned but not yet tested in the intended environment.

A starter-template page, mockup, AI suggestion, developer assumption or planned hosting option is **not** a client-approved requirement or verified implementation.

## 2. Project

**Title:** Barangay Mayondon Records and Document Issuance System

### Client profile

- **Office:** Barangay Mayondon Local Government Unit, Los Baños, Laguna
- **Interview dates:** October 19 and 20, 2026
- **Contacts:** Ma'am Margarita R. Rivera (Admin Assistant); Sir Kelly Renz G. Villegas (Barangay Clerk)
- **Relevant function:** Maintaining resident records and preparing and issuing barangay documents and Barangay IDs
- **Users:** Authorized barangay office personnel. Residents are the subjects of records and requesters of documents; **public access has not been requested**.

## 3. Background and problem

Staff use Google Sheets, Excel and document templates for resident records, ID details and document requests. Reusing templates means repeated data entry and makes previous issuances hard to track. Staff reported spreadsheet errors, saving issues and missing files.

Staff want to find existing resident records, enter request details once, fill approved formats, and print without retyping. For clearances, staff currently type resident and transaction details into an Excel workbook (one worksheet per form) that prints **only the entered details onto a blank pre-printed form**. The pre-printed paper already has the official header, labels, signature area and dry-seal space. The system must follow this workflow, with print placement calibrated and tested so text lines up with the pre-printed fields. Barangay IDs are prepared in Excel and Publisher with manual print-size adjustments.

The office has slow internet, prefers an offline system, has **no dedicated server**, and has computers connected on a local network.

## 4. Objectives and success criteria

1. Centralize resident records and related information in a structured system.
2. Let authorized staff search and retrieve existing resident and Barangay ID records.
3. Keep a separate history of document requests and issuances (including issue and expiry dates) instead of overwriting prior transactions.
4. Reduce repeated data entry and make preparing and printing approved documents and IDs easier.
5. Provide a suitable local backup and recovery procedure.

| ID | Success criterion | Proposed verification | Status |
|---|---|---|---|
| GOAL-01 | Centralize resident records | Create, edit, search and retrieve sample resident records | In brief |
| GOAL-02 | Preserve request and issuance history | Issue several sample documents for one resident without overwriting earlier ones | In brief |
| GOAL-03 | Reduce repeated data entry | Populate approved sample layouts from stored records and verify the print | In brief |
| GOAL-04 | Work without internet for normal tasks | Run the approved workflow with the internet disconnected on the agreed LAN | Architecture not validated |
| GOAL-05 | Local backup and recovery | Complete a backup and restore test using synthetic data | Procedure to be agreed **(D-35)** |

These verification methods are proposals; confirm them with the client before using them as acceptance criteria.

## 5. Target users

Six clerical staff (two female, four male; ages about 30–60), including the night-duty staff member, handle resident records, document preparation and issuance. The interface must be simple, easy to navigate and readable for staff with different computer experience, including senior staff.

## 6. Scope

### Included

- Staff login for six accounts, all with full access as written in the revised brief **(D-10)**
- Dashboard of documents issued and clearances/IDs nearing expiry
- Resident record management, search, and import of existing masterlist data
- Family, beneficiary and marginalized-sector details where the current workflow needs them
- Resident and Barangay ID number records
- Document request entry with an editable list of purposes
- Issuance history with issue and expiry dates
- Auto-filled printing of approved documents and Barangay IDs, including ID photo upload
- Local data backup and restore

### Excluded

- Public-facing resident accounts, online announcements, website content, public applications, online payments and fee collection
- Blotter, incident and tanod records (discussed, but outside the clerical-document system prioritized)
- Business and building clearances handled by the municipality
- Documents issued by other agencies (e.g. BIR, PhilHealth). The barangay's own Certificate of Indigency **is** in scope
- Creating, imitating or applying official signatures or dry seals — these remain manual
- Cloud hosting, online synchronization, and any internet-dependent service
- Purchase of hardware, network equipment or internet service
- Integration with, replacement of, or compliance claims about **LGUSS-BIMS** (see section 10)

Confirm any change to this list with the client before coding.

## 7. Main features

1. **Login** — six staff accounts, all with full access (brief). *Proposed alternative:* Staff and System Administrator roles **(D-10)**.
2. **Dashboard** — documents issued; clearances/IDs nearing expiry **(D-21)**.
3. **Resident Records** — add, edit, search, import masterlist.
4. **Family and Sector Details** — only where the client workflow requires **(D-20)**.
5. **ID Records** — preserve existing Barangay ID numbering. Normal validity is one year; **six months** for new or renting residents until proof of voter registration is provided. The client also keeps a separate list of newer residents (from 2019) with registered/unregistered remarks **(D-18)**.
6. **Document Requests** — record requests, maintain document purposes, preserve issuance history.
7. **Document and ID Printing** — populate approved layouts, including the ID photo. Print only variable details on the existing blank form; calibrate position, scaling, paper size, margins and printer settings against the real forms and test printed samples before acceptance. Do not recreate the pre-printed header, labels, signature or dry-seal area unless the client approves a different layout. Details: [04-Documents-and-Printing.md](04-Documents-and-Printing.md).
8. **Backup and Restore** — scheduled **and** manual local backups to an external drive; agree on schedule, custody, restore procedure and responsibilities, then test **(D-35)**.

### Proposed additions beyond the brief (NOT approved)

These exist in the Admin portal prototype or design drafts. The team has marked the role split and registration flow as intentional proposals; the client has not approved them.

| Proposal | Conflicts with / extends the brief | Decision |
|---|---|---|
| Staff vs System Administrator roles | Brief says all six accounts have full access | D-10 |
| Staff self-registration ("Request Access") with admin approval | Brief and README say no public sign-up; admin creates accounts | D-11 |
| Officials management (separate from accounts) | Not listed in brief | D-23 |
| Activity Log / audit history | Not listed in brief | D-24 |
| Management Reports | Not listed in brief | D-21 |
| Document types beyond the brief's list (Damayan, Residency, First-Time Jobseekers) | Brief: confirm the final list; do not add documents merely because a sample exists | D-13 |

## 8. Platform

- **Preferred:** fully offline, on the office LAN, no internet needed for normal use.
- **Devices:** existing office computers and printers (details unverified).
- **Installation:** one designated office computer runs the application and local PostgreSQL; other office computers use a browser over the LAN. The host must stay on during service hours **(D-31)**.
- **Backup destination:** external drive.
- **Technical direction and status:** [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md). The Docker path is preparation only.

Still unconfirmed: internet reliability, devices at the office, expected concurrent use, LAN/Wi-Fi restrictions, maintenance owner and client-side support after turnover **(D-36)**.

## 9. Look and feel

Simple, formal, modern, quick to navigate. Neutral palette — navy blue, white and light gray suggested from the barangay logo (confirm). Official logo supplied by the client. Clean sans-serif such as Arial. Clear labels and readable text for senior users. No reference websites were named. Visual details: [03-Design-and-UI.md](03-Design-and-UI.md) **(D-28)**.

## 10. LGUSS-BIMS boundary (client update, October 27, 2026)

The team asked the barangay contact about the DILG Local Government Unit Support System – Barangay Information Management System (LGUSS-BIMS). The contact said it is an old system and is no longer used by the barangay. Record this as **the contact's statement only**; it does not prove DILG discontinued LGUSS-BIMS or that it is unavailable to other barangays.

- The 2025 DILG memorandum circular on LGUSS-BIMS is a reference for relevant barangay information-management and privacy concerns.
- This student-built system is **separate**. Do not call it a replacement for, certified compliant with, or integrated with LGUSS-BIMS.
- No LGUSS-BIMS data exchange, synchronization or official DILG connection is in scope.

## 11. Functional requirements

| ID | Requirement | Draft acceptance criteria | Status |
|---|---|---|---|
| FR-001 | Staff login | Only approved office accounts can sign in; no public sign-up | Brief; account model pending (D-10, D-11) |
| FR-002 | Dashboard | Show issuance counts and clearances/IDs nearing expiry | Brief |
| FR-003 | Resident records | Add, edit, search, retrieve and import approved masterlist fields | Brief; field mapping pending (D-19) |
| FR-004 | Family and sector details | Store only where the approved workflow requires | Brief; fields pending (D-20) |
| FR-005 | ID records | Store existing ID numbers and agreed validity/registration details without inventing rules | Brief; exceptions pending (D-18) |
| FR-006 | Requests and history | Each request/issuance is a separate transaction (purpose, issue date, expiry where applicable) | Brief |
| FR-007 | Document printing | Populate approved formats from stored data and preserve the approved layout | Samples received; final list/layout pending (D-13, D-17) |
| FR-008 | Barangay ID preparation | Populate approved ID layout; support photo input | Brief; photo workflow pending (D-18) |
| FR-009 | Local backup and restore | Back up approved data locally and restore it in a test | Frequency/custody pending (D-35) |

## 12. Non-functional requirements

| ID | Topic | Target | How to verify | Status |
|---|---|---|---|---|
| NFR-001 | Usability | Simple navigation, readable text, clear labels, efficient office workflow | Client walkthrough; Instrument B | Draft |
| NFR-002 | Performance | Record search and document preparation practical for daily use | Test with representative synthetic data; agree response times | Target pending |
| NFR-003 | Security | Authentication for staff-only features; block unauthorized access | Test login and permissions at UI and API level | Roles pending |
| NFR-004 | Privacy | Minimize resident data, restrict access, agree retention and handling | Client review of fields, permissions, backup and retention | Pending |
| NFR-005 | Recovery | Local backups are restorable | Documented restore test | Procedure pending |
| NFR-006 | Devices/browsers | Existing office computers and printers | Verify actual devices, browsers, printers with client | Pending |
| NFR-007 | Connectivity | Normal use needs no internet | Disconnect internet and test on the LAN | Architecture pending |
| NFR-008 | Maintainability | Operating instructions, user manual, documented backup/restore | Review at technology transfer | Draft |

## 13. Client-supplied materials

| Content | Reported received |
|---|---|
| Hard copies: Barangay Clearance, Franchise Clearance, Certificate of Indigency, clearance for electrical and water connection | Oct 19, 2026 |
| Current clearance-issuing Excel sheet | Oct 19, 2026 |
| Barangay Mayondon logo and Barangay ID layout (Publisher) | Oct 20, 2026 |
| Resident and ID data: ID Number Masterlist, ID System-Mayondon, marginalized-sector sheets | Oct 20, 2026 |
| Residency and First-Time Jobseeker documents | Oct 20, 2026 |
| Other document samples | To be confirmed |

Treat resident and ID data as confidential. Never commit real resident data to Git or use it in public demos.

## 14. Timeline (from the brief)

| Milestone | Working date |
|---|---|
| Client interviews | Oct 19–20, 2026 |
| Information architecture approval | Oct 27, 2026 |
| Design phase | Oct 26–31, 2026 |
| Development phase | Nov 1–8, 2026 |
| Testing | Nov 9–13, 2026 |
| Presentation | Nov 16 or 19, 2026 |

The instructor's Final Project Guide governs academic dates and wins on conflict. See the date conflict in [01-Project-and-Schedule.md](01-Project-and-Schedule.md) **(D-05)**.

## 15. Decisions made

| Date | Decision | Evidence / decision maker |
|---|---|---|
| 2026-10-15/18 | Start from the Full Stack FastAPI Template, tailored for this project | Project team |
| 2026-10-18 | Keep the `Foundation` branch as the working branch. **Superseded Nov 1, 2026 (D-08):** see the Nov 1 branch decision below | Project team |
| 2026-10-18 | Pause additional security code changes until a real hosting setup can be inspected | Project team |
| 2026-10-19/20 | Offline-first, local-network operation preferred | Client interviews; recorded in brief |
| 2026-10-25 | Replace Vercel/Supabase hosting direction with Docker Compose + local PostgreSQL | Project team |
| 2026-10-27 | Print only variable details onto existing pre-printed forms (overlay), never recreate the form | Client description; team |
| 2026-10-28 | Admin/Staff split and staff self-registration with admin approval are **intentional proposals** to take to the client | Project team |
| 2026-11-01 | Remove on-screen sample/prototype banners; all data remains fictional | Project team |
| 2026-11-01 | Branches: `master` = docs; `draft/admin-portal` = UI and code, and the Version 1 demo runs from it; `Foundation` frozen as a read-only reference (D-08) | Project team |
| 2026-11-01 | The design was coded directly as the `draft/admin-portal` prototype; no wireframes, separate mockups, mobile mockups or client feedback exist yet (D-06) | Project team (fact, not an approval) |
| 2026-11-01 | Drop the public `/welcome` direction; entry goes to staff login (D-27) | Project team |
| 2026-11-01 | Responsive but desktop-first; phone view not prioritized (D-29) | Project team |
| 2026-11-01 | Docker Desktop to start at Windows sign-in; sign-in required first, to be verified by a reboot test (D-34) | Project team |
| 2026-11-01 | `/docs` API page need not work offline (D-37); test instruments kept in `docs/testing/` (D-07) | Project team |
| — | Free-tier AI assistants only; the docs are the shared context | Project team |

## 16. Approval

| Client representative | Group leader |
|---|---|
| Signature over printed name: ____________________ | Signature over printed name: ____________________ |
| Date: ____________________ | Date: ____________________ |

Creative Brief signed by the professor (final). Keep the signed copy for the final report. Technical architecture and deployment are approved and verified **separately** from requirements approval.
