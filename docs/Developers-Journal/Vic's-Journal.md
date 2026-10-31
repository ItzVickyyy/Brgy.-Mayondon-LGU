# Vic's Journal

**Developer:** Vic John O. Salen Jr.  
**Role:** Project Leader, Lead Developer  
**Project repository:** [Brgy. Mayondon LGU](https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU)  
**Local working directory:** C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU  
**Timezone for entries:** Asia/Manila (UTC+08:00)

Use [Journal-Template.md](Journal-Template.md) for future entries. Historical entries below use only known dates and work details. Times are marked “Time not recorded” when the exact time is unavailable.

---

## Repository created

- **Date:** 2026-10-15
- **Time:** Time not recorded
- **Phase:** Project setup
- **Status:** Completed

### Goal
Create the repository for the Barangay Mayondon LGU Web System final project.

### Work performed
- Created the GitHub repository [ItzVickyyy/Brgy.-Mayondon-LGU](https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU).
- Set the local working directory to C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU.

### Outcome
The repository was created on October 15, 2026. The client-specific requirements were not yet established and must come from the barangay interview and approved Creative Brief.

---

## Foundation development started

- **Date:** 2026-10-18
- **Time:** Time not recorded
- **Phase:** Foundation
- **Status:** In progress

### Goal
Prepare a reliable technical and documentation foundation while keeping client-specific features on hold until requirements are confirmed.

### Work performed / achievements known from the project record
- Began Foundation development on October 18, 2026.
- Worked from the starter template and tailored the repository for this project.
- Established documentation for the project source of truth, technology stack, developer workflow, startup steps, and security measures.
- Kept the current working branch named Foundation. It must not be renamed or merged into master without an explicit team decision.
- Kept uncertain starter-template modules until the client confirms whether they are needed.
- Documented Vercel + Supabase as the planned hosting direction, not a completed or verified deployment.

### AI tools and workflow
The development workflow recorded for this project uses a dedicated ChatGPT Project:
1. Maintain project instructions and source documents in the ChatGPT Project.
2. Use that project to discuss tasks, provide context, and plan implementation.
3. If Claude is needed, ask ChatGPT to prepare a detailed prompt using the available project context and requirements, then provide that prompt to Claude.
4. When a conversation approaches its token/context limit, ask the current AI to prepare a handover so another chat, AI tool, or account can continue with the relevant context.
5. Review AI output and verify repository changes, tests, and CI instead of treating AI output as proof that the work is correct.

This describes Vic's stated workflow. It does not imply Claude was used for every task.

---

## Foundation security review and documentation

- **Date:** 2026-10-18
- **Implementation time:** Time not recorded
- **Journal entry prepared:** 2026-10-18; exact time not recorded
- **Phase:** Foundation security review
- **Status:** Code-level tasks completed; production verification pending

### Goal
Address the agreed code-level security tasks, document evidence, and avoid claiming production security without an actual deployment to inspect.

### Work coordinated and recorded
- Access tokens are invalidated when a user's password changes or resets.
- Account setup emails use a time-limited password setup link instead of including the supplied plaintext password.
- Password recovery sends the email address in the JSON request body instead of the URL.
- Password recovery has configurable email/IP rate limits and associated tests.
- Password changes clear login lockout state.
- Updated docs/Security-Measures.md to state explicitly that production hosting verification is pending and that no further Foundation security code changes are planned until the actual hosting setup is available.
- Kept the Foundation branch and did not create a PR or merge it into master.

### AI tools and workflow
- **Tool:** ChatGPT, using the project-specific context and repository documentation.
- **How used:** Plan and coordinate focused repository tasks, review code/documentation changes, and check automated CI.
- **Review:** Checked the repository's recorded changes and actual GitHub Actions results before describing the work as passing. Production controls remain unverified because the real hosting environment is not yet configured and inspected.

### Tests and verification
- **CI commit checked:** b159e78c9c4504a50d64a4092ff0e75db08d85ce
- **Result:** All 13 GitHub Actions checks passed, including backend tests, frontend lint/build, Docker Compose checks, secret scanning, workflow security scanning, and all four Playwright shards.
- **CI run:** https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU/actions/runs/39132822005
- **Known gap:** CI does not verify production HTTPS, environment variables, proxy/IP behavior, database permissions, backup restoration, or client operational data-handling procedures.

### Current decision
Keep Foundation and its passing CI. Pause further security code changes. Leave production verification explicitly pending until the actual hosting setup is available for inspection and testing. Do not enter real resident data before required safeguards and approvals are in place.

### Next actions
- [ ] When hosting is configured, verify the deployment checklist against the real environment and record evidence in docs/Security-Measures.md.
- [ ] Continue client requirements gathering. Do not build client-specific modules before the interview and signed Creative Brief.
- [ ] Record every future project work session using the journal template.


---

## CI repair: Mailpit email configuration and full verification

- **Date:** 2026-10-25
- **Time:** Time not recorded
- **Phase / milestone:** Foundation stabilization before Week 14 initial design
- **Work type:** Bug fix, CI verification, documentation
- **Status:** CI passed for the implementation commit; journal update verification pending

### Goal
Resolve the Playwright password-recovery failures while preserving the default offline deployment behavior, then verify the complete GitHub Actions run.

### Work performed
- Investigated the failing Playwright workflow and reviewed the local Docker Compose override, Mailpit test helper, password-recovery route, and environment configuration.
- Found that the development override configured the Mailpit SMTP host and port but did not set `EMAILS_FROM_EMAIL`. Since email enablement requires both a configured SMTP host and sender email, password-recovery messages were not sent to Mailpit.
- Updated `compose.override.yml` to set a development-only sender address for Mailpit tests. The main `compose.yml` and `.env.example` retain the offline default with email disabled.
- Committed the change directly to `Foundation` as `eff82f498268dfd07c12ffef2af6536f3fac1967`. No pull request, branch rename, or merge was performed.

### Achievements / outcome
The implementation commit passed all observed GitHub Actions workflows:
- Backend tests and dependency audit
- Frontend tests
- Docker Compose integration
- Playwright tests across all four shards
- Offline deployment verification
- Secret Scan
- Zizmor workflow security scan
- Conflict detector

### AI tools and workflow
- **Tool:** ChatGPT with the GitHub repository connector.
- **How used:** Inspect CI run results, review relevant repository files, identify the missing test-only configuration, update the file on the requested branch, and verify the new commit's workflow results.
- **Human review:** The CI run was checked against the exact implementation commit. The project team should still review the configuration change and understand why the sender email is required for Mailpit.
- **Limitations:** No local Docker build, local test suite, real no-internet test, or barangay LAN deployment was performed in this session.

### Tests and verification
- **Implementation commit:** `eff82f498268dfd07c12ffef2af6536f3fac1967`
- **Playwright:** Passed, including all four shards and report merge.
- **Backend:** Passed.
- **Frontend:** Passed.
- **Docker Compose integration:** Passed.
- **Offline deployment verification:** Passed.
- **Security and workflow checks:** Passed.
- **Evidence:** https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU/actions/runs/40200654707
- **Known gaps:** CI success does not prove the packaged application works without internet on the target computer, across the barangay LAN, or with actual printers and approved records.

### Blockers, risks, and decisions
- The Creative Brief remains unsigned according to the project status documentation. Do not treat draft requirements or the local LAN architecture as client-approved.
- Resident data must remain out of source control and automated test fixtures.
- The client’s current use of online background removal remains an unresolved offline-workflow issue.

### Next actions
- [ ] Confirm the CI run triggered by this journal update passes.
- [ ] Prioritize the Week 14 design deliverables for October 26 and 29: sitemap, wireframes, at least the suggested number of full-color and mobile mockups, style guide, and client feedback list. Confirm bracketed quantities with Prof. Camba.
- [ ] Review the Creative Brief with the client and obtain the required signatures before treating the scope as approved.
- [ ] Schedule a separate synthetic-data test of the offline/LAN setup before any use of real resident records.


---

## Offline dependency audit and isolated-runtime verification

- **Date:** 2026-10-25
- **Time:** Time not recorded
- **Phase / milestone:** Week 14 preparation, offline/LAN deployment verification
- **Work type:** Architecture audit, deployment test, bug fix, CI verification
- **Status:** Offline deployment CI check passed on the implementation commit; remaining workflows and actual client-site testing must still be verified.

### Goal
Audit the `Foundation` branch for Vercel/Supabase runtime dependencies and strengthen automated verification that the packaged system can run without internet egress.

### Work performed
- Reviewed the local Docker Compose configuration, frontend build configuration, frontend package dependencies, application startup, database settings, offline deployment guide, and relevant environment files.
- Confirmed the intended Docker path uses local PostgreSQL and packages the built frontend with FastAPI. The frontend package does not list a Supabase SDK, and the offline environment example leaves SMTP and Sentry settings empty.
- Identified remaining configuration/code references that are not required by the offline startup path: root and frontend `vercel.json` files, optional Supabase transaction-pooler handling in the database settings, and an interactive Swagger UI endpoint that uses CDN-hosted assets. These remain audit items; they should not be confused with active dependencies of the staff-facing UI.
- Extended `.github/workflows/verify.yml` to build the app, start PostgreSQL and the app on an internal Docker network with no internet egress, apply migrations, initialize a test administrator, check local frontend assets and the SPA login route, exercise login/token authentication, and confirm that the application container cannot reach a public IP.
- The first CI test attempt exposed that direct navigation to `/login` returned 404 in the packaged self-hosted app. Replaced the previous frontend mount with a guarded SPA fallback that serves existing local assets, returns `index.html` for client-side routes, prevents unknown API paths from returning the frontend, and rejects paths that escape the frontend directory.
- Corrected the isolated-network test to perform its checks from inside the app container. The internal Docker network is intentionally not reachable through a published host port in this test arrangement.
- Committed changes directly to `Foundation`. No branch rename, pull request, or merge was performed.

### Tests and verification
- **Frontend route fix commit:** `8ca885ee9547f2c52f6e2652fb9ddf47b2c111c6`
- **Offline deployment verification:** Passed on that commit. The test applied database migrations, initialized a test administrator, started the app without internet egress, and passed the runtime checks.
- **Other GitHub Actions workflows:** Still running at the time of this journal entry. Verify the latest branch head before reporting the full CI suite as green.
- **Local testing:** No local Docker build or local test suite was run.
- **Client-site testing:** No test was performed on the barangay's computers, printer, or actual LAN. This CI simulation does not replace the required physical offline/LAN test.

### Remaining findings and risks
- The Vercel configuration files and optional Supabase-related connection-pool code remain in the repository, but they are not needed for the local Docker path with default settings.
- The custom `/docs` endpoint uses Swagger UI assets hosted externally, so that developer documentation page may not render fully without internet. The staff-facing frontend uses packaged local assets.
- The client's online background-removal process for resident ID photos remains unresolved. Do not upload resident photos to an external service for testing or production use without explicit client approval and privacy review.
- The signed Creative Brief, client approval of the LAN architecture, real offline operation, printer behavior, backup/restore, and deployment security remain unverified. Do not use real resident data until the required approvals and safeguards are in place.

### Next actions
- [ ] Verify all GitHub Actions for the latest `Foundation` commit, including backend, frontend, Docker Compose, Playwright, secret scanning, Zizmor, conflict detection, and offline deployment verification.
- [ ] Decide whether to remove the unused Vercel configuration files and Supabase-specific optional connection-pool support, or retain them as inactive historical/template configuration.
- [ ] Decide whether the API documentation page must work offline. If required, replace its CDN dependency with locally packaged assets.
- [ ] Before client deployment, build and cache all images while online, then test the system with internet disconnected while preserving the office LAN. Verify login, records, local assets, document printing, multi-computer access, restart behavior, and backup/restore using synthetic data.
- [ ] Continue Week 14 design deliverables and obtain client approval of the Creative Brief and architecture before adding client-specific modules.


---

## Offline deployment command safety correction

- **Date:** 2026-10-25
- **Time:** Time not recorded
- **Phase / milestone:** Week 14 preparation, offline/LAN deployment
- **Work type:** Deployment configuration review, documentation and script correction
- **Status:** Updated on `Foundation`; full CI verification for the latest journal commit is pending.

### Finding
A review of the deployment instructions found that plain `docker compose` automatically includes `compose.override.yml`. That override is intended for local development and adds Adminer, Mailpit, and Playwright services, publishes PostgreSQL on all host interfaces, and configures the backend for development. Using the default command for an office LAN deployment could expose development-only services and the database.

### Changes made
- Updated `docs/Offline-LAN-Deployment.md` to use `docker compose -f compose.yml` for configuration validation, build, startup, status, logs, migrations, and initialization.
- Updated `scripts/backup-db.ps1` and `scripts/restore-db.ps1` to target the base deployment file explicitly, including database lookup, backup/restore operations, and backend stop/start commands.
- Kept `compose.override.yml` available for the existing local development and test workflow. The offline deployment guide now bypasses it explicitly rather than relying on default Compose file discovery.

### Verification and limitations
- **Offline deployment verification:** Passed on the same application code before these documentation/script-only changes, and passed again on commit `a778931888dc9f0bdb4bed0a0d87a3df22bdff85`.
- **Other CI workflows:** Still running at the time of this entry. Check the latest branch head before reporting all workflows green.
- **PowerShell scripts:** Reviewed and updated through GitHub, but not executed on a Windows host in this session.
- **Client site:** Actual LAN, firewall, printer, offline operation, and backup/restore remain unverified at Barangay Mayondon.

### Next actions
- [ ] Verify all workflows on the latest `Foundation` commit.
- [ ] On the deployment computer, use only `docker compose -f compose.yml` for the offline deployment. Do not use plain `docker compose up -d` for the client setup.
- [ ] Test backup and restore with synthetic data before any real resident data is loaded.


---

## Remove unused Vercel deployment configuration

- **Date:** 2026-10-25
- **Time:** Time not recorded
- **Phase / milestone:** Week 14 preparation, offline/LAN deployment
- **Work type:** Repository cleanup
- **Status:** Removed directly from `Foundation`; CI verification is pending.

### Work performed
- Deleted the repository-root `vercel.json`, which defined a split Vercel frontend/backend deployment and rewrites.
- Deleted `frontend/vercel.json`, which defined Vercel SPA rewrites.
- The intended self-hosted deployment uses `compose.yml`, the backend image, packaged frontend assets, and local PostgreSQL. These two Vercel configuration files are not required for that path.
- No branch rename, pull request, or merge was performed.

### Verification and limitations
- The two file deletions were committed directly to `Foundation`.
- No local build or test suite was run for this cleanup.
- Verify GitHub Actions for the latest branch head before treating the repository as green.
- This removes the two Vercel configuration files only. It does not claim that every historical reference to Vercel or Supabase has been removed, nor does it prove that the application works on the client's LAN without internet.

### Next actions
- [ ] Verify all relevant GitHub Actions on the latest `Foundation` commit.
- [ ] Continue the dependency audit for any remaining Vercel/Supabase-specific code or environment variables and remove only code confirmed to be unnecessary for the approved offline design.
- [ ] Run the real offline/LAN, printing, and backup/restore checks with synthetic data before client-site use.


---

## Remove unused hosted-deployment configuration and database pooler support

- **Date:** 2026-10-25
- **Time:** Time not recorded
- **Phase / milestone:** Week 14 preparation, offline/LAN deployment
- **Work type:** Repository cleanup, configuration simplification, documentation maintenance
- **Status:** Changes committed directly to `Foundation`; final CI verification is pending.

### Changes made
- Deleted the repository-root `vercel.json` and `frontend/vercel.json`.
- Removed the Vercel-specific `[tool.vercel]` section from `backend/pyproject.toml`.
- Simplified `backend/app/core/db.py` to use a standard SQLAlchemy connection pool with the configured database URL. Removed Supabase transaction-pooler handling, `NullPool` selection, and the special psycopg prepared-statement option.
- Removed the `DATABASE_POOL_MODE` and `MIGRATION_DATABASE_URL` settings from `backend/app/core/config.py`, removed the pool-mode environment value from `.env.example`, and simplified Alembic to use `DATABASE_URL`.
- Updated the tech-stack, offline deployment, system specification, and source-of-truth documents to describe the current local PostgreSQL/Docker deployment path and no longer claim the old Vercel/Supabase configuration remains active.
- Kept the existing offline Docker deployment path and local PostgreSQL configuration. No database schema or migration was changed.

### Verification and limitations
- Changes were committed directly to `Foundation`. No branch rename, pull request, or merge was performed.
- No local backend tests, frontend tests, Docker build, or Windows deployment test was run in this session.
- The cleanup removes Vercel-specific configuration and Supabase transaction-pooler compatibility from the active code, but the full CI suite must pass before the latest branch head is treated as verified.
- This does not prove the system works at Barangay Mayondon without internet. Client-site LAN, printing, backup/restore, security, and Creative Brief approval remain pending.

### Next actions
- [ ] Verify backend, frontend, Docker Compose, Playwright, secret scan, Zizmor, conflict detector, and offline deployment workflows for the latest `Foundation` head.
- [ ] Inspect any remaining Vercel/Supabase mentions and distinguish historical journal entries from active configuration or runtime dependencies.
- [ ] Run the offline deployment and backup/restore checks with synthetic data on the actual test computer before client-site use.
