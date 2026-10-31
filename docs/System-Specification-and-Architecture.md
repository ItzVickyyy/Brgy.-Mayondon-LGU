# System Specification and Architecture

**Status: Requirements derived from the client interviews and the final Creative Brief (signed by the professor) — local-network architecture approval and deployment verification are pending.**

This document combines client requirements and technical architecture in one place so the team can maintain a single system reference. The snapshot below records the October 19–20, 2026 interviews. The requirements are not formally approved until the client reviews and signs `Creative-Brief.md`. The repository now uses an initial Docker-based local-host path for offline LAN operation, with legacy Vercel configuration and Supabase transaction-pooler handling removed. The local path is preparation only and has not yet been tested on the barangay's network or approved by the client.

The academic schedule, grading, team workflow, and overall project status remain in [Source-of-Truth.md](Source-of-Truth.md). Use [Security-Measures.md](Security-Measures.md) for the active security checklist.

## 1. Document control

- **Project:** Barangay Mayondon LGU Web System
- **Client:** Barangay Mayondon LGU, Los Baños, Laguna
- **Version:**
- **Prepared by:**
- **Date prepared:**
- **Interview date:**
- **Client contacts interviewed:** Ma’am Margarita R. Rivera, Admin Assistant; Sir Kelly Renz G. Villegas, Barangay Clerk
- **Last updated:**
- **Creative Brief:** Final; signed by the professor
- **Client approval / signature:** Pending
- **Architecture status:** Docker-based offline LAN preparation added; client approval and site verification pending
- **Deployment verification:** Pending

## 2. Status and decision rules

Use these labels consistently:

- **Proposed:** An idea or question to discuss. Not approved.
- **Confirmed:** The client explicitly confirmed it. Record who confirmed it and when.
- **Approved:** Included in a client-reviewed and approved requirements document or signed Creative Brief.
- **Deferred:** Discuss later.
- **Rejected:** The client or team decided not to include it. Record the reason and decision owner.
- **Pending verification:** The implementation or deployment has not yet been tested in the intended environment.

Do not treat an existing starter-template page, mockup, AI suggestion, developer assumption, or planned hosting option as a client-approved requirement or verified implementation.

## Interview-derived requirements snapshot (October 19–20, 2026)

The current draft system name is **Barangay Mayondon Records and Document Issuance System**. Staff described using Google Sheets, Excel, and document templates, with problems involving spreadsheet errors, saving issues, missing files, repeated data entry, and lack of issuance history when existing records or templates are overwritten.

The client's stated preference is a **fully offline system** because the office internet is slow. The office reported having connected computers but no dedicated server. The proposed arrangement in the Creative Brief is one designated office computer running the application and local PostgreSQL database, with other office computers connecting over the local network. The repository has an initial Docker Compose path for this model, documented in `Offline-LAN-Deployment.md`. The arrangement remains unverified and must be validated for feasibility, availability, security, backup/restore, and maintenance responsibilities.

### Current draft scope

- Staff-only login for six office users. Confirm account permissions with the client.
- Dashboard for documents issued and clearances/IDs nearing expiry.
- Resident record management, search, and import of existing masterlist data.
- Family, beneficiary, and marginalized-sector details where required.
- Resident and Barangay ID number records, including the client's stated validity rules and new-resident tracking.
- Document request entry, editable purpose list, and separate issuance history with expiry dates.
- Auto-filled printing for client-approved documents and Barangay IDs, including ID photo upload where required.
- Local backup and restore.

### Current draft exclusions

- Public-facing access, online announcements, and online payments.
- Blotter, incident, and tanod records, which were discussed separately and are outside the currently prioritized clerical-document scope.
- Business and building clearances described as municipal processes.
- Documents issued by other agencies, such as BIR and PhilHealth. The barangay's own Certificate of Indigency is included.
- Creating or applying official signatures or dry seals. These remain manual.
- Cloud hosting, online synchronization, and other internet-dependent services.
- Purchasing hardware, network equipment, or internet service.

### Important unresolved design and technical decisions

1. The proposed client path is Docker Compose with local PostgreSQL and the frontend served by FastAPI. Legacy Vercel configuration and Supabase transaction-pooler handling have been removed. This setup has not yet been tested on the client's network or approved by the client. Do not represent it as production-ready.
2. The client currently uses an online background-removal service for ID photos. A fully offline workflow needs a client-approved local alternative or a clearly documented manual workaround. Do not upload real resident photos to an external service.
3. Confirm exact document types, approved layouts, required data fields, import rules, ID numbering and validity rules, account permissions, and the backup/restore procedure.
4. Treat resident and ID information as confidential. Use synthetic data in development and demonstrations, restrict access, and agree on data handling, retention, backups, and recovery with the client in line with the Data Privacy Act of 2012.

See [Creative-Brief.md](Creative-Brief.md) for the full working brief and approval fields. The interview notes are in the group's interview document; the source file should remain in the project records.

---

## 3. Client background and current process

- **Office:** Barangay Mayondon Local Government Unit, Los Baños, Laguna.
- **Interview contacts:** Ma’am Margarita R. Rivera, Admin Assistant, and Sir Kelly Renz G. Villegas, Barangay Clerk.
- **Current tools:** Google Sheets, Excel, document templates, and Excel/Publisher for Barangay ID preparation.
- **Pain points reported:** Spreadsheet errors, saving issues, missing files, repeated data entry, overwritten records, difficulty reviewing prior issuances, and manual print-size adjustments.
- **Users:** Six clerical personnel were identified as likely users, including a night-duty staff member.
- **Network and internet:** The office reported connected computers, no dedicated server, slow internet, and a preference for offline use.
- **Evidence:** Interview notes dated October 19 and 20, 2026, and [Creative-Brief.md](Creative-Brief.md).

## 4. Client-confirmed problem, goals, and success criteria

### Problem statement

The current spreadsheet and template workflow makes it difficult to maintain consistent resident records and preserve separate document-issuance history. Staff want to search for existing information, reduce repeated typing, and populate approved document formats for printing.

### Draft goals and success criteria

| ID | Goal / success criterion | Proposed verification | Source / date | Status |
|---|---|---|---|---|
| GOAL-01 | Centralize resident records and related information | Create, edit, search, and retrieve sample resident records | Interviews, Oct 19–20, 2026 | In the final Creative Brief |
| GOAL-02 | Preserve document request and issuance history | Issue multiple sample documents for one resident without overwriting prior transactions | Interviews, Oct 19–20, 2026 | In the final Creative Brief |
| GOAL-03 | Reduce repeated data entry for approved documents and Barangay IDs | Populate approved sample layouts from stored records and verify print preview | Interviews, Oct 19–20, 2026 | In the final Creative Brief |
| GOAL-04 | Work without internet for normal office tasks | Test the approved workflow with internet disconnected on the agreed LAN setup | Client preference, Oct 19–20, 2026 | Architecture not yet validated |
| GOAL-05 | Provide local backup and recovery | Complete a backup and restore test using synthetic data | Draft objective in Creative Brief | Procedure to be agreed |

These are proposed ways to verify the interview goals. Confirm them with the client before treating them as final acceptance criteria.

## 5. Users, roles, and permissions

| Role / user group | Responsibilities described in interview | Proposed access | Status |
|---|---|---|---|
| Clerical staff (six likely users) | Resident records, document preparation, and issuance | Access needed for the approved clerical workflow; exact permissions pending | Draft |
| Admin Assistant / other office staff | Interview contacts; duties include office administration and may overlap with clerical work | Confirm whether they need the same or different permissions | Pending |
| Residents / public | Subjects of stored records and requesters of documents | No public account or direct system access requested in the interviews | Draft scope exclusion |

Do not assume that all six accounts should have identical privileges merely because the final Creative Brief describes full access. Confirm who may view, edit, import, print, back up, restore, and manage accounts. Enforce the final permission matrix in the backend and test direct API requests.

## 6. Functional requirements

The requirements below come from the client interviews and the final Creative Brief, which was signed by the professor. Client-site validation of the architecture and deployment is still pending.

| ID | Requirement | Draft acceptance criteria | Source / status |
|---|---|---|---|
| FR-001 | Staff login | Only approved office accounts can sign in; no public sign-up | Interview-derived draft |
| FR-002 | Dashboard | Show document issuance counts and clearances/IDs nearing expiry | Final Creative Brief |
| FR-003 | Resident records | Add, edit, search, retrieve, and import client-approved resident masterlist fields | Interview-derived draft; field mapping pending |
| FR-004 | Family and sector details | Store family, beneficiary, and marginalized-sector details only where required by the approved workflow | Interview-derived draft |
| FR-005 | ID records | Store existing ID numbers and agreed validity/registration details without inventing numbering rules | Interview-derived draft; exceptions to confirm |
| FR-006 | Document requests and history | Record each request/issuance as a separate transaction, including purpose, issue date, and expiry date where applicable | Interview-derived draft |
| FR-007 | Document printing | Populate client-approved document formats using stored data and preserve the approved layout | Sample formats received; final list/layout approval pending |
| FR-008 | Barangay ID preparation | Populate the approved ID layout and support photo input where agreed | Client described current Excel/Publisher workflow |
| FR-009 | Local backup and restore | Back up approved application data locally and restore it successfully in a test | Frequency and custody pending |

## 7. Non-functional requirements

| ID | Topic | Draft requirement / target | How to verify | Status |
|---|---|---|---|---|
| NFR-001 | Usability | Simple navigation, readable text, clear labels, efficient office workflow | Client walkthrough and user evaluation | Draft |
| NFR-002 | Performance | Common record search and document preparation should be practical for daily office use | Test with representative synthetic data; agree acceptable response times | Target pending |
| NFR-003 | Security | Require authentication for staff-only features and restrict unauthorized access | Test login and permissions at UI and API levels | Exact roles pending |
| NFR-004 | Privacy | Minimize resident data, restrict access, and agree on retention and handling | Client review of fields, permissions, backup, and retention | Pending |
| NFR-005 | Recovery | Local backups must be restorable | Perform and document a restore test | Procedure pending |
| NFR-006 | Devices and browsers | Existing barangay office computers and printers | Verify actual device/browser/printer setup with client | Details pending |
| NFR-007 | Connectivity | Normal system use should not require internet if offline operation is approved | Disconnect internet and test across the intended LAN | Architecture pending |
| NFR-008 | Maintainability | Provide operating instructions, user manual, and documented backup/restore procedure | Review during technology transfer | Draft |

Follow the Philippine Data Privacy Act of 2012 and the client's procedures for resident personal information. Use synthetic data in development and demonstrations unless real-data use is explicitly authorized and appropriately protected.

## 8. Scope, exclusions, and data

### Draft in-scope features

- Staff login and a dashboard.
- Resident records, search, and import of approved masterlist data.
- Family, beneficiary, and marginalized-sector details where needed.
- Resident and Barangay ID records.
- Document request entry, purpose selection, and separate issuance history.
- Auto-filled printing of client-approved documents and Barangay IDs.
- Local backup and restore.

### Draft exclusions

- Public-facing resident accounts, announcements, and online payments.
- Blotter, incident, and tanod records, discussed separately from the clerical workflow prioritized in the interviews.
- Business and building clearances described as municipal processes.
- Documents issued by other agencies, such as BIR and PhilHealth. The barangay's own Certificate of Indigency remains in the draft scope.
- Creating or applying official signatures or dry seals; these remain manual.
- Cloud hosting, online synchronization, and internet-dependent services.
- Purchase of hardware, network equipment, or internet service.

### Data and document types to confirm

The interviews mentioned resident masterlists, family/beneficiary details, ID-number records, marginalized-sector sheets, Barangay Clearance, Franchise Clearance, Certificate of Indigency, clearance for electrical and water connection, residency-related documents, First-Time Jobseeker documents, and Barangay ID. Confirm the exact document list, required fields, formats, and which samples are still in use before implementation.

Do not commit real resident records to source control. Agree on import validation, duplicate handling, data correction, access permissions, retention, backup custody, and recovery responsibilities before using production data.

---

## 9. Platform, connectivity, and operating environment

- **Online, offline, or hybrid:** Client stated a preference for fully offline operation during the October 19–20, 2026 interviews. The final Creative Brief records this preference; client-site validation is pending.
- **Internet availability / reliability:** Pending
- **Devices available at the office:** Pending
- **Expected users and concurrent use:** Pending
- **Network restrictions / Wi-Fi / LAN requirements:** Pending
- **Hosting preference and constraints:** Client prefers a local office system because internet is slow. The proposed Docker-based LAN host is not yet approved or site-verified.
- **Maintenance owner after turnover:** Pending
- **Client-side technical support:** Pending
- **Networking 2 requirements confirmed with instructor:** Pending

These decisions affect system architecture, hosting, availability, cost, security, and the Networking 2 setup. Do not finalize them until the client and relevant instructor expectations are known.

## 10. Integrations and client-supplied materials

### Integrations

| Service / system | Purpose | Data exchanged | Owner / access | Confirmed? |
|---|---|---|---|---|
| Pending interview | Pending | Pending | Pending | No |

### Content and materials supplied by the client

- Official logo / seal:
- Brand colors / design guide:
- Approved public contact details:
- Sample forms / logbooks:
- Existing documents or datasets:
- Photos / announcements / text:
- Permission and restrictions on using supplied material:
- Person responsible and expected date:

Do not publish placeholder contact details as facts. Do not commit confidential documents or resident records to the repository.

## 11. Current technology baseline and proposed architecture

The following is the current Foundation repository baseline, not a commitment that every technology or starter-template module will remain in the final client system.

| Layer | Current baseline / option | Status / notes |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui | Present in repository |
| Backend | FastAPI, Python, SQLModel | Present in repository |
| Database | PostgreSQL | Current development database; production setup unverified |
| API | HTTP API between frontend and backend | Confirm production routing after deployment is configured |
| Development / tests | Docker Compose, backend tests, frontend lint/build, Playwright, GitHub Actions | Check CI for the exact commit |
| Prepared hosting option | Docker Compose local host with FastAPI-served frontend and local PostgreSQL | Matches the interview preference for offline use, but client approval, LAN/site verification, and security checks remain pending |

### Architectural principles

- Base the final scope on the client's interview and signed Creative Brief.
- Keep the system understandable and maintainable for a three-person student team and the client receiving it.
- Enforce authentication, authorization, and validation on the server.
- Minimize personal data and apply the Data Privacy Act of 2012 and client-approved handling procedures.
- Keep secrets and real resident data out of source control, AI prompts, screenshots, and documentation.
- Prefer small, testable modules and automated regression tests.
- Mark proposals and unverified deployment assumptions clearly.

Do not change the stack or remove starter-template modules solely because they seem unnecessary. Revisit these decisions after requirements gathering.

### System context and boundary

_To be completed after the client interview._

Record the users and offices, the process being supported, external systems or services, what remains manual, and who owns and maintains the system after turnover.

Provisional Foundation boundary only:

    Approved users --> Web interface --> Backend API --> PostgreSQL database
                                      Backend API - - optional approved integrations - -> External services

This is a generic starting point, not a final approved feature architecture.

## 12. Sitemap and navigation

**Status: Not defined.** Build the sitemap from confirmed user roles and approved features after the interview. Do not treat existing starter-template routes as approved pages.

    System
    ├── Public pages: pending requirements
    ├── Authenticated area: pending requirements
    │   ├── Role / section A: pending requirements
    │   └── Role / section B: pending requirements
    └── Administrative area: pending requirements

For each approved page, record its name, purpose, allowed roles, entry points, actions, and destination after each action. Replace the placeholders only after requirements are known.

## 13. Components and data flow

_To be confirmed after functional requirements are approved._

| Component | Responsibility | Inputs / outputs | Dependencies | Status |
|---|---|---|---|---|
| Frontend | Present approved workflows and collect user input | HTTP requests and rendered responses | Backend API | Current baseline |
| Backend API | Validate requests, authorize actions, apply business rules | Requests, responses, database operations | PostgreSQL and approved external services | Current baseline |
| Database | Persist approved records and enforce integrity | Queries and transactions | Backend | Current baseline |
| Email / external services | Only if client-approved features require them | To be defined | Provider and configuration | Not confirmed |

## 14. Database and entity relationship design

**Status: Final ERD pending client requirements.**

For each approved entity, document its purpose, key fields, relationships, constraints, retention, and permissions. Do not design a resident-data schema from assumptions.

| Entity | Purpose | Main relationships | Personal data involved? | Approval status |
|---|---|---|---|---|
| Existing starter-template entities | Inspect and retain until scope is confirmed | Review against approved requirements | Must be assessed before use | Review pending |

Attach or link the approved ERD here after the data requirements have been discussed with the client.

## 15. Authentication, authorization, security, and privacy

- **Approved user roles:** Pending interview.
- **Account creation and recovery process:** Review current Foundation behavior against approved operational needs before deployment.
- **Permission matrix:** Pending confirmed roles and actions.
- **Session / token handling:** Foundation includes password-hash-bound access-token invalidation; see [Security-Measures.md](Security-Measures.md).
- **Audit requirements:** Confirm which actions the client needs recorded and who may review logs.
- **Account ownership and offboarding:** Confirm who administers accounts after handover.
- **Data retention and deletion:** Pending client-approved rules.
- **Backups and restore responsibilities:** Pending confirmation.
- **Incident reporting and response owner:** Pending confirmation.

Never rely only on frontend visibility to enforce permissions. Test protected API operations directly. Use [Security-Measures.md](Security-Measures.md) as the active security checklist. Production checks remain pending until the actual hosting environment is available to inspect and test.

## 16. Hosting and network topology

**Status: Not production-verified.**

- **Client preference (online/offline/hybrid):** Client stated a preference for fully offline operation during the October 19–20, 2026 interviews. The final Creative Brief records this preference; the deployment arrangement is still pending.
- **Client internet and devices:** Pending verification.
- **Prepared option:** Docker Compose local-host deployment for offline LAN use. Vercel-specific configuration and Supabase transaction-pooler handling have been removed from the active deployment code.
- **Alternative:** Assess if connectivity, provider terms, privacy requirements, or instructor expectations make the planned option unsuitable.
- **TLS / HTTPS:** Production verification pending.
- **CORS / trusted proxy:** Production verification pending.
- **Database network access / permissions:** Production verification pending.
- **Backups and restore test:** Production verification pending.
- **Monitoring, logs, and incident owner:** Pending.
- **Networking 2 setup and instructor expectations:** Confirm with the client and instructor.

Do not describe the application as deployed until it has actually been configured and verified in the target environment. Do not enter real resident data before required safeguards and approvals are in place.

## 17. Assumptions, constraints, and open questions

| ID | Question / constraint | Why it matters | Owner | Target date, if known | Status / answer |
|---|---|---|---|---|---|
| OPEN-001 | What problem and process should the system address? | Defines scope and system design | Project team | Client interview | Open |
| OPEN-002 | Validate the proposed local-host/LAN arrangement against the client's fully offline preference recorded in the final Creative Brief | Affects architecture, hosting, availability, and Networking 2 | Project team / client | Before design approval and deployment planning | Preference stated in Oct 19–20 interviews and recorded in the final Creative Brief; site validation pending |
| OPEN-003 | Who will use the system, and what permissions are needed? | Affects UX and authorization | Project team / client | Client interview | Open |
| OPEN-004 | What data is necessary, and what must remain outside the system? | Affects schema, privacy, and scope | Project team / client | Client interview | Open |
| OPEN-005 | What devices, connectivity, maintenance, and support are available at the barangay? | Affects deployment and handover | Project team / client | Client interview | Open |
| OPEN-006 | Which modules and integrations are client-approved? | Prevents unneeded development | Project team / client | Client interview | Open |
| OPEN-007 | Which hosting option is suitable and permitted for intended LGU use? | Affects cost, privacy, and availability | Project team / client / instructors | To be confirmed | Open |
| OPEN-008 | What are the backup, retention, handover, and incident-response responsibilities? | Protects client operations and data | Project team / client | To be confirmed | Open |
| OPEN-009 | What does each instructor require for Client-Server Technologies and Networking 2? | Ensures subject requirements are covered | Project team / instructors | To be confirmed | Open |

Add further questions during preparation and the interview. Close questions only after recording a clear answer and its source.

## 18. Decisions and requirement change history

Record decisions that have actually been made. Keep proposals in the open questions list until approved.

| Date | Requirement / design decision or change | Reason and evidence | Decision maker / approver | Status |
|---|---|---|---|---|
| 2026-10-18 | Keep Foundation as the current working branch | Project workflow decision | Project team | Confirmed |
| 2026-10-18 | Pause additional Foundation security code changes and leave production verification pending | Hosting environment is not yet available for verification | Project team | Confirmed |
| — | Final system modules, sitemap, and ERD | Awaiting design work based on the final Creative Brief | Client / project team | Pending |

For future changes, include date and time, requirement or design section, change requested, reason/source, decision maker, and status. Preserve important rejected or deferred decisions so the team can explain the scope.

## 19. Review and approval

- **Reviewed with client by:**
- **Review date:**
- **Client comments / requested changes:**
- **Creative Brief signed:** Yes — signed by the professor (final)
- **Client approver name and position:**
- **Approval date:**
- **Related meeting / interview notes:**
- **Architecture review date:**
- **Deployment verification evidence / commit / test record:**

Do not mark the requirements approved until the client has reviewed them and the team has followed the approval process agreed with the instructor. Technical architecture and production deployment must be verified separately from client requirements approval.
