# System Specification and Architecture

**Status: WORKING TEMPLATE — client requirements, final design, and production deployment are not yet verified.**

This document combines client requirements and technical architecture in one place so the team can maintain a single system reference. It is not evidence that Barangay Mayondon LGU has requested or approved any feature. Complete the requirements sections from the client interview, get the Creative Brief and requirements reviewed and signed as required, then update the architecture to match those confirmed needs.

The academic schedule, grading, team workflow, and overall project status remain in [Source-of-Truth.md](Source-of-Truth.md). Use [Security-Measures.md](Security-Measures.md) for the active security checklist.

## 1. Document control

- **Project:** Barangay Mayondon LGU Web System
- **Client:** Barangay Mayondon LGU, Los Baños, Laguna
- **Version:**
- **Prepared by:**
- **Date prepared:**
- **Interview date:**
- **Client contact person and position:** Pending confirmation
- **Last updated:**
- **Client approval / signature:** Pending
- **Architecture status:** Foundation baseline; final design pending interview
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

## 3. Client background and current process

Complete from the client interview. Do not infer the current process.

- **Office / department:**
- **Client contact and role:**
- **Current process being considered:**
- **Current tools, forms, logbooks, or software:**
- **People involved in the current process:**
- **Pain points described by the client:**
- **Frequency / volume of work, if provided:**
- **Evidence or interview-note reference:**

## 4. Client-confirmed problem, goals, and success criteria

### Problem statement

- **Client-confirmed problem:**
- **Who is affected:**
- **Impact of the problem:**
- **Current workaround:**
- **Evidence / source:**

### Goals and success criteria

| ID | Goal / success criterion | How it will be measured | Source / date | Status |
|---|---|---|---|---|
| GOAL-01 | To be confirmed with the client | To be agreed | Pending interview | Proposed |

## 5. Users, roles, and permissions

| Role / user group | Confirmed responsibilities | Data/actions allowed | Data/actions restricted | Confirmed by / date | Status |
|---|---|---|---|---|---|
| To be determined | Pending interview | Pending | Pending | Pending | Proposed |

Do not assume residents, staff, administrators, or any other group will have an account. Confirm whether the system is public-facing, staff-only, or mixed. The permission matrix must be reflected in backend authorization and tested through API requests, not only through frontend visibility.

## 6. Functional requirements

| ID | Requirement | Priority | Acceptance criteria | Source / date | Status |
|---|---|---|---|---|---|
| FR-001 | Pending client interview | TBD | TBD | Pending | Proposed |

Add one row per specific, testable requirement. Link requirements to interview notes or an approved client document. Keep rejected and deferred requests visible in the change history rather than silently deleting the decision.

## 7. Non-functional requirements

| ID | Topic | Requirement / target | How to verify | Source / date | Status |
|---|---|---|---|---|---|
| NFR-001 | Usability and accessibility | Pending | Pending | Pending | Proposed |
| NFR-002 | Performance and expected workload | Pending | Pending | Pending | Proposed |
| NFR-003 | Security and access control | Pending | Pending | Pending | Proposed |
| NFR-004 | Privacy, retention, and handling of personal data | Pending | Pending | Pending | Proposed |
| NFR-005 | Availability and recovery | Pending | Pending | Pending | Proposed |
| NFR-006 | Supported devices and browsers | Pending | Pending | Pending | Proposed |
| NFR-007 | Network / internet availability | Pending | Pending | Pending | Proposed |
| NFR-008 | Maintainability and handover | Pending | Pending | Pending | Proposed |

## 8. Scope, exclusions, and data

### Scope

- **In-scope features confirmed by the client:**
- **Out-of-scope features:**
- **Tasks that will remain manual:**
- **Known limitations:**
- **Reason and approval for exclusions:**

Pending interview and signed Creative Brief.

### Data and records

For each type of data the client says the system needs, document its purpose, source, authorized users, retention, and handling rules. Do not include actual personal records in this document.

| Data / record type | Purpose | Source / provider | Authorized roles | Retention / deletion rule | Sensitivity / safeguards | Status |
|---|---|---|---|---|---|---|
| Pending interview | Pending | Pending | Pending | Pending | Pending | Proposed |

Confirm requirements under the Philippine Data Privacy Act of 2012 and the client's approved procedures before collecting or entering real personal data. Keep real resident data, confidential records, and secrets out of this repository.

## 9. Platform, connectivity, and operating environment

- **Online, offline, or hybrid:** Pending client discussion
- **Internet availability / reliability:** Pending
- **Devices available at the office:** Pending
- **Expected users and concurrent use:** Pending
- **Network restrictions / Wi-Fi / LAN requirements:** Pending
- **Hosting preference and constraints:** Pending
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
| Planned hosting | Vercel for frontend/API and Supabase PostgreSQL | Planned only; compatibility, terms, configuration, cost, and production security require verification |

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

- **Client preference (online/offline/hybrid):** Pending interview.
- **Client internet and devices:** Pending verification.
- **Planned option:** Vercel frontend/API plus Supabase PostgreSQL, subject to client requirements, provider terms, configuration support, cost, and security verification.
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
| OPEN-002 | Should the system work online, offline, or both? | Affects architecture, hosting, and Networking 2 | Project team / client | Client interview | Open |
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
| — | Final system modules, sitemap, and ERD | Awaiting client interview and signed Creative Brief | Client / project team | Pending |

For future changes, include date and time, requirement or design section, change requested, reason/source, decision maker, and status. Preserve important rejected or deferred decisions so the team can explain the scope.

## 19. Review and approval

- **Reviewed with client by:**
- **Review date:**
- **Client comments / requested changes:**
- **Creative Brief signed:** No — pending
- **Client approver name and position:**
- **Approval date:**
- **Related meeting / interview notes:**
- **Architecture review date:**
- **Deployment verification evidence / commit / test record:**

Do not mark the requirements approved until the client has reviewed them and the team has followed the approval process agreed with the instructor. Technical architecture and production deployment must be verified separately from client requirements approval.
