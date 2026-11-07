# 05 · Roles, Security and Privacy

Who may do what, the security checklist, and the privacy safeguards for resident data. Combines the former Roles and Access Plan, Security Measures Checklist and the barangay safeguards from the client update.

**Read this first:** this is a **checklist and plan, not proof the system is secure.** Record evidence for completed checks and track unresolved risks. Do not tick an item because a feature exists. Passing automated tests means the tested checks passed — nothing more. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 5, 2026

**Labels:** **Core** applies regardless of client features · **When applicable** only if that feature or deployment model is used · **Before deployment** must be verified on the real hosting/network before real users or data.

---

## Part A. Roles and access

### A1. What the client approved vs what the team proposes

The signed brief says **six staff accounts, all with full access**. The prototype instead proposes **Staff** and **System Administrator** roles, There is no staff self-registration: only an administrator creates accounts (owner decision, Nov 7, 2026, **D-11**). The team confirmed (Oct 28) that the Staff/System Administrator split is an *intentional proposal* to take to the client. It is **not** a client-approved permissions policy **(D-10)**.

### A2. Proposed roles

- **Staff** — routine resident-record and document-issuance work; views and updates the records needed for duties; views their own activity.
- **System Administrator** — routine work plus user accounts, access, system configuration, reports, backup/restore and administrative review.

**Current implementation:** the API exposes `is_superuser`. The prototype maps System Administrator → `is_superuser = true` and Staff → `false`. This is a **UI/API mapping, not a role enum or a permission system.** A future backend should use a role enum `admin` / `staff` (UI label for `admin`: System Administrator). **Not implemented.**

### A3. Proposed access matrix

| Module / action | Staff | System Administrator |
|---|---|---|
| Dashboard | Operational cards, own recent activity | Same, plus system-wide activity |
| Records Management, Residents: search, view, add, edit | Allowed | Allowed |
| Records Management, Import Masterlist tab | No (proposed; confirm) | Allowed |
| Records Management: archive | No | Allowed |
| Issuance: create, review, print, correct with reason | Allowed | Allowed |
| Issuance: void/cancel | No | Allowed |
| Records Management, Barangay IDs tab: list and view | Allowed | Allowed |
| Barangay IDs: create, renew, print (done through Issuance Management, ID document type) | Allowed | Allowed |
| Records Management, Barangay IDs: override validity rules | No | Allowed |
| Activity Log | Own activity | All users, with filters |
| My Account, User Settings | Allowed | Allowed |
| Officials, User Accounts | No | Allowed |
| Management Reports | No | Allowed |
| Backup and Restore | No; manual-backup permission to confirm | Allowed |

If the client keeps "six accounts, full access", still review whether deletion, export, account administration and sensitive-data access should be restricted **(D-25)**.

### A4. Account status (not needed)

No account `status` column is planned. Accounts are created only by the System Administrator, so there is no pending or rejected state (D-11, decided Nov 7, 2026). The existing `is_active` boolean is enough to disable an account. `/users/signup` stays disabled (`USERS_OPEN_REGISTRATION=False`). Do not add approval endpoints.

### A5. Audit history (planned, not implemented)

Append-only history for sensitive actions: who, when, affected record, reason where required. Ordinary users cannot rewrite or delete entries; any retention/cleanup must be explicitly controlled and documented. Never log passwords, tokens, reset links or unnecessary resident data **(D-24)**.

### A6. Account lifecycle

- First administrator is provisioned through controlled initial setup (`FIRST_SUPERUSER` in `.env`). There is **no public sign-up**; an admin creates accounts. The User Accounts table shows whatever the database holds, including this seeded account; it is deployment data, not code. **Before real use, create a real admin in User Accounts, then delete the seed account** (the app refuses to delete the last active admin).
- Use **individual** accounts, not shared ones.
- Disable access when staff leave or no longer need it, while preserving required issuance history.
- Account setup and password reset by email **will not work offline** (no SMTP). The local procedure is implemented (owner decision, Nov 7, 2026, **D-12**): the System Administrator sets a temporary password in User Accounts and gives it to the user in person. The user can sign in, but every protected page and API operation is refused until the password is changed; only reading the user's own account and changing their own password are allowed. After a successful change, the user is signed out and must sign in again. The Activity Log records `user.temp_password_set` and `user.password_change` without storing the password. No email and no recovery codes. This is an owner decision, not client approval.
- Only the System Administrator creates, disables or re-enables accounts **(D-11)**. Who holds that role in the barangay office is still for the client to name.

---

## Part B. Security controls implemented in the Foundation branch

Implementation, not production approval. CI evidence: all 13 GitHub Actions checks passed on commit `b159e78c…` (Oct 18) and the offline-deployment check passed on later commits (Oct 25). Always check the run for the **exact commit** you are relying on.

- Password recovery attempts are counted in PostgreSQL per normalized email and client IP using keyed HMAC bucket IDs (raw emails/IPs are not stored). Limits are configurable (time window, per-email, per-IP). The endpoint returns a generic response for unknown, throttled and eligible accounts to reduce account enumeration.
- Password-reset and access tokens are bound to the user's current password hash, so a password change or reset invalidates earlier reset links and access tokens. Regression tests cover reset-token reuse and access-token invalidation.
- Password recovery takes the email in a JSON body, not the URL path.
- Admin-created account emails contain a time-limited password **setup link**, not a plaintext password; the link dies when the password changes.
- Expired rate-limit buckets are cleaned up during recovery requests; an index supports it.
- Passwords are hashed with Argon2 (bcrypt supported). Login uses JWT bearer tokens. Password changes clear login-lockout state.
- Open sign-up is disabled.

**Not verified in CI:** HTTPS, environment variables on the real host, proxy/IP behavior, database permissions, backup restoration, client data-handling procedures.

---

## Part C. Security checklist

### C1. Secrets and configuration
- **Core** Keep secrets out of source, frontend bundles, screenshots, logs and docs. Commit placeholders only.
- **Core** Scan Git **history** for committed secrets; rotate any exposed secret (removing it from the latest commit is not enough).
- **Core** Separate credentials for development, tests and deployment.
- **Before deployment** Replace all sample/default credentials and signing keys (`SECRET_KEY` ≥ 32 bytes, strong `POSTGRES_PASSWORD`, strong first-admin password). Unsafe defaults must fail clearly.
- **Before deployment** Frontend build variables hold only values safe to expose.
- **Before deployment** No development-only routes, debugging or verbose exceptions.

### C2. Authentication and authorization
- **Core** Enforce authentication **on the server** for every protected API operation; hiding a page or button is not access control.
- **Core** Server-side permission checks on admin and staff endpoints; check record ownership/scope on every read, change, export or delete; allowlist the fields each role may change (protect role, status, privileges).
- **Core** Hash passwords; never store or log plaintext. Generic login errors. Test failed-login throttling/lockout.
- **When applicable** RBAC from **client-approved** roles with least privilege.
- **When applicable** Rate-limit password reset, account creation and other sensitive endpoints in a way that works with the hosting model.
- **When applicable** Bearer tokens: review storage, expiry, revocation and XSS exposure (cookies would need Secure/HttpOnly/SameSite and CSRF protection).
- **Core** Logout and deactivation invalidate credentials as designed.
- **Core** Test authorization for every role, **including direct API calls** that bypass the UI.

### C3. Database and data protection
- **Core** Parameterized queries/ORM only; validate all input on the server (type, length, allowed values, relationships).
- **Core** Return only needed fields; never expose password hashes, tokens or unnecessary resident data.
- **Core** Enforce integrity in backend logic and database constraints.
- **Core** Least-privilege database account; separate migration privileges if the design allows.
- **Core** The database and its admin tools are never reachable from the public internet — and **the PostgreSQL port must not be published to the LAN**.
- **Core** Data minimization: collect and keep only what client-approved workflows need.
- **Core** Follow the Data Privacy Act of 2012 and client procedures (purpose, access, retention, correction, disclosure).
- **When applicable** Review imports, exports, reports and downloads for unauthorized access or excess personal data.
- **Before deployment** TLS where traffic crosses an untrusted network; confirm how database files, volumes and **backups** are protected at rest (see D-33).
- **Before deployment** Back up, restrict backup access, and **test a restore** — an untested backup is not a recovery plan.
- **Core** Synthetic or masked data for development, tests, screenshots and demos.

### C4. Input, browser and API
- **Core** Framework-safe output rendering (XSS); sanitize HTML if ever accepted.
- **Core** CORS limited to specific trusted origins; no permissive origins with credentials. CORS is not CSRF defense.
- **Core** Safe error handling (no stack traces, SQL, secrets, paths).
- **Core** Security headers (CSP where practical, `X-Content-Type-Options`, clickjacking protection).
- **When applicable** File uploads (**the ID photo upload applies**): restrict type, size and count; do not trust filename or MIME type alone; store safely; never execute uploads.
- **When applicable** Validate redirects and external URLs (SSRF).
- **Core** Request size, pagination and timeout limits.

### C5. Application, services and operations
- **Core** Keep dependencies and base images updated through tested changes; review advisories.
- **Core** Run with least OS/database privilege; not as root unless required and understood.
- **Before deployment** Disable debug mode and dev utilities; no test-user or test-email endpoints in the client install.
- **Before deployment** Use **only** `docker compose -f compose.yml` for the client install. Plain `docker compose` auto-loads `compose.override.yml` (Adminer, Mailpit, Playwright services, PostgreSQL published on all interfaces, development settings).
- **Before deployment** Windows Defender Firewall stays **on**; allow only the application port (default 8000) on the Private profile for the trusted office LAN; review ports from the user network.
- **Before deployment** HTTP is **unencrypted on the LAN**. Decide whether HTTPS is required for the client's risk level **(D-33)**.
- **Core** Keep logs for authentication failures, permission denials, admin actions and unexpected errors; never log secrets or unnecessary personal data; restrict access and define retention.
- **Before deployment** Decide who reviews logs, how incidents are reported and how credentials are rotated.
- **When applicable** Document recovery steps and prove the system can be restored after database loss or a failed deployment.

### C6. Testing and release
**During development / pull requests (Core):** run backend, frontend, integration and relevant end-to-end tests; keep CI green and never disable security checks to get green; test allowed and denied requests, invalid/oversized/unexpected input, and attempts to change protected fields or reach another user's records; run dependency and secret scanners and review findings; give extra review to changes in authentication, permissions, migrations, environment config, CORS, logging and deployment files.

**Before a release or client deployment:** verify configuration on the real environment; verify HTTPS/TLS (if used), headers, CORS and exposed ports from the intended user network; test each approved role; test validation, injection resistance, login throttling, recovery controls and token behavior; resolve all critical/high findings or document reason, mitigation, approver and plan; confirm backups and recovery, admin ownership, credential handover and incident contacts; document remaining risks and get client approval of operating procedures. A passing CI run does not prove compliance or production readiness.

### C7. Security review record (copy per release or review)

- Review date / Reviewer(s):
- Commit or release reviewed / Environment reviewed:
- Checks completed / Not applicable and why:
- Findings and severity / Fixes or mitigations:
- Accepted risks, approver, review date:
- Backup and recovery verification:
- Decision: Not reviewed · Changes required · Approved for testing · Approved for deployment

---

## Part D. Barangay-specific privacy safeguards

These are **requirements to implement and verify, not claims that they exist.**

- Collect only resident information the approved workflows need **(D-19)**.
- Confirm whether the six accounts truly need full access to view, edit, delete, export and administer accounts **(D-10, D-25)**.
- Enforce authentication and authorization in the backend, not only by hiding controls.
- Keep an accountability trail for important record changes and document issuance without logging unnecessary personal data **(D-24)**.
- Protect the host computer, LAN access, database, printed documents, exports and backup media; agree physical-access rules.
- Agree backup ownership and schedule, and **test a restore before turnover** **(D-35)**.
- Disable access when staff leave, preserving required issuance history.
- Use synthetic or masked data for development, screenshots and class demos; **no real resident records or secrets in source control, AI prompts, screenshots, journals or issues.**
- Add security and recovery cases to Instrument A, fix failures and retest before deployment.
- Confirm the client's access, retention, correction, disclosure and incident-handling procedures before real data is entered **(D-38)**.
- Do **not** claim a formal Privacy Impact Assessment, penetration test, encryption at rest, legal approval, privacy-compliance certification or LGUSS-BIMS compliance unless the work is done and evidenced.

**Gate for real resident data:** client approval of data handling, instructor approval, passing deployment checks, tested backup/restore, and backend authorization verified. Until then: *suitable for development and controlled testing with synthetic data only* **(D-40)**.

---

## Part E. Verification status

**Current status: PENDING.** The hosting design changed on Oct 25 from Vercel + Supabase to a local Docker + PostgreSQL deployment on the office LAN, so the old Vercel/Supabase verification items **no longer apply** and have been removed from this checklist. What remains open is verification of the **actual LAN deployment** — see the acceptance checklist in [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md). The team agreed (Oct 18) to pause further security code changes until the real hosting setup can be inspected; role/status/audit work is therefore **planned, not started** **(D-39)**.
