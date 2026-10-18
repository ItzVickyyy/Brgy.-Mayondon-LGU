# System Architecture

**Status: WORKING REFERENCE — client requirements and deployment are not yet verified.**

This document is the technical reference for how the system is or is proposed to be structured. It is a companion to [Source-of-Truth.md](Source-of-Truth.md), not a replacement for it. Confirmed client requirements belong in [System-Specification.md](System-Specification.md). If a proposed design conflicts with confirmed client needs, update the design and record the decision. Do not treat a proposal below as client approval.

## 1. Document control
- **Version:**
- **Prepared by:**
- **Last updated:** October 18, 2026
- **Architecture status:** Foundation baseline; final design pending interview
- **Client approval:** Pending
- **Deployment verification:** Pending

## 2. Architectural principles
- Base scope on the client's interview and signed Creative Brief.
- Keep the system understandable and maintainable for a three-person student team and the client receiving it.
- Enforce authentication, authorization, and validation on the server.
- Minimize personal data and apply the Data Privacy Act of 2012 and client-approved handling procedures.
- Keep secrets and real resident data out of source control, AI prompts, screenshots, and documentation.
- Prefer small, testable modules and automated regression tests.
- Mark proposed choices and unverified deployment assumptions clearly.

## 3. Current Foundation technology baseline

The following describes the repository's current Foundation baseline. It does not mean every technology or starter-template module will necessarily remain in the final client system.

| Layer | Current baseline | Status / notes |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui | Present in repository |
| Backend | FastAPI, Python, SQLModel | Present in repository |
| Database | PostgreSQL | Current development database; production setup unverified |
| API | HTTP API between frontend and backend | Confirm production routing after deployment is configured |
| Development / tests | Docker Compose, backend tests, frontend lint/build, Playwright, GitHub Actions | Re-check CI for the exact commit |
| Planned hosting | Vercel for frontend/API and Supabase PostgreSQL | Planned only; compatibility, terms, configuration, and production security need verification |

Do not change the stack or remove starter-template modules solely because they seem unnecessary. Revisit these decisions after requirements gathering.

## 4. Context and system boundary

### System context
_To be completed after the client interview._

Record:
- The people and offices that will use the system.
- The process or problem the system will support.
- External systems, services, or data sources, if any.
- What stays outside the system or remains a manual process.
- Who owns, operates, and maintains the system after turnover.

### Proposed boundary diagram

Replace or expand this diagram only after the client-confirmed scope is known.

    Client-approved users --> Web interface --> Backend API --> PostgreSQL database
                                      Backend API - - optional, approved integrations - -> External services

This is a generic Foundation diagram, not a final approved feature architecture.

## 5. Sitemap / navigation structure

**Status: Not defined.** Build the sitemap from confirmed user roles and approved features after the interview. Do not treat existing starter-template routes as approved sitemap pages.

### Sitemap placeholder

    System
    ├── Public pages: pending requirements
    ├── Authenticated area: pending requirements
    │   ├── Role / section A: pending requirements
    │   └── Role / section B: pending requirements
    └── Administrative area: pending requirements

For each approved page, record its name, purpose, allowed roles, entry points, actions, and destination after each action. Replace the placeholders when requirements are known.

## 6. Component and data-flow design

_To be confirmed after functional requirements are approved._

| Component | Responsibility | Inputs / outputs | Dependencies | Status |
|---|---|---|---|---|
| Frontend | Present approved workflows and collect user input | HTTP requests and rendered responses | Backend API | Current baseline |
| Backend API | Validate requests, authorize actions, apply business rules | Requests, responses, database operations | PostgreSQL and approved external services | Current baseline |
| Database | Persist approved records and enforce integrity | Queries and transactions | Backend | Current baseline |
| Email / external services | Only if client-approved features require them | To be defined | Provider and configuration | Not confirmed |

## 7. Database and entity relationship design

**Status: Final ERD pending client requirements.**

For each approved entity, document its purpose, key fields, relationships, constraints, retention, and permissions. Do not design a resident-data schema from assumptions.

| Entity | Purpose | Main relationships | Personal data involved? | Approval status |
|---|---|---|---|---|
| Existing starter-template entities | Inspect and retain until scope is confirmed | Review against approved requirements | Must be assessed before use | Review pending |

Attach or link the approved ERD here once the data requirements have been discussed with the client.

## 8. Authentication and authorization
- **Approved user roles:** Pending interview.
- **Account creation and recovery process:** Review current Foundation behavior against approved operational needs before deployment.
- **Permission matrix:** Pending confirmed roles and actions.
- **Session / token handling:** Foundation includes password-hash-bound access-token invalidation; see [Security-Measures.md](Security-Measures.md).
- **Audit requirements:** Confirm which actions the client needs recorded and who may review logs.
- **Account ownership and offboarding:** Confirm who administers accounts after handover.

Never rely only on frontend visibility to enforce permissions. Test protected API operations directly.

## 9. Hosting and network topology

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
- **Networking 2 setup and instructor expectations:** Confirm with the client and Sir Ramos.

Do not describe the application as deployed until it has actually been configured and verified in the target environment. Do not enter real resident data before required safeguards and approvals are in place.

## 10. Security and privacy controls

Use [Security-Measures.md](Security-Measures.md) as the active checklist. Record architecture-specific decisions here, including:
- Data minimization and purpose of collection.
- Role-based access and record ownership rules.
- Secrets and environment configuration.
- Logging that avoids passwords, tokens, and unnecessary personal data.
- Data retention, deletion, backup, and recovery.
- Incident reporting and account/credential ownership.
- Data Privacy Act of 2012 considerations and client-approved handling rules.

Deployment checks remain pending until the actual hosting environment is available to inspect and test.

## 11. Design decisions and change log

Record only decisions that have been made. Keep proposals in the open questions list until approved.

| Date | Decision / change | Reason and evidence | Approved by | Status |
|---|---|---|---|---|
| 2026-10-18 | Keep Foundation as the current working branch | Project workflow decision | Project team | Confirmed |
| 2026-10-18 | Pause additional Foundation security code changes and leave production verification pending | Hosting environment is not yet available for verification | Project team | Confirmed |
| — | Final system modules, sitemap, and ERD | Awaiting client interview and signed Creative Brief | Client / project team | Pending |

## 12. Open architecture questions
- [ ] What exact workflow and problem must the system support?
- [ ] Should the solution be online, offline, or hybrid?
- [ ] Which user groups need access, and what may each role do?
- [ ] What data is necessary, and what must remain outside the system?
- [ ] What devices, connectivity, maintenance, and support are available at the barangay?
- [ ] Which modules and integrations are client-approved?
- [ ] What hosting option is suitable and permitted for the intended LGU use?
- [ ] What does each instructor require for Client-Server Technologies and Networking 2?
- [ ] What are the backup, retention, handover, and incident-response responsibilities?

Update this list after the interview. Link each answer to the interview notes, approved specification, or documented decision. Do not silently convert assumptions into facts.
