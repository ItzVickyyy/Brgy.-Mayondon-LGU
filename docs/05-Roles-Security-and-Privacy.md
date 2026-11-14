# 05 · Roles, Security and Privacy

Who may do what, the security checklist, and the privacy safeguards for resident data. Combines the former Roles and Access Plan, Security Measures Checklist and the barangay safeguards from the client update.

**Read this first:** this is a **checklist and plan, not proof the system is secure.** Record evidence for completed checks and track unresolved risks. Do not tick an item because a feature exists. Passing automated tests means the tested checks passed — nothing more. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 7, 2026

**Labels:** **Core** applies regardless of client features · **When applicable** only if that feature or deployment model is used · **Before deployment** must be verified on the real hosting/network before real users or data.

---

## Part A. Roles and access

### A1. What the client approved vs what the team proposes

The signed brief says **six staff accounts, all with full access**. The prototype instead proposes **Staff** and **System Administrator** roles, There is no staff self-registration: only an administrator creates accounts (owner decision, Nov 7, 2026, **D-11**). The team confirmed (Oct 28) that the Staff/System Administrator split is an *intentional proposal* to take to the client. It is **not** a client-approved permissions policy **(D-10)**.

### A2. Proposed roles

- **Staff** — routine resident-record and document-issuance work; views and updates the records needed for duties; views their own activity.
- **System Administrator** — routine work plus user accounts, access, system configuration, reports, backup/restore and administrative review.

**Current implementation (backend):** each account has a `role` of `admin` (UI label: System Administrator) or `staff`, stored in the database with constraints that reject any other value. The legacy `is_superuser` flag is kept for older clients and is always equal to `role = admin` (the database enforces this; the API accepts either field and rejects a conflict). `backend/app/core/permissions.py` holds the role → permission matrix; implemented resident, lookup, official, issuance, activity, dashboard, report and user routes enforce their declared permissions with `require_permission`. The role is read from the database on every request, so a role change or deactivation applies immediately. `LOOKUPS_MANAGE` is admin-only and controls adding, renaming and deleting unused Streets and Tricycle Associations. Backup/restore routes are not implemented; there are no account approval states (D-11). This matrix is still a **proposal, not a client-approved policy (D-10)**.

### A3. Proposed access matrix

| Module / action | Staff | System Administrator |
|---|---|---|
| Dashboard | Operational cards, own recent activity | Same, plus system-wide activity |
| Records Management, Residents: search, view, add, edit | Allowed | Allowed |
| Records Management, Import Masterlist tab | No (proposed; confirm) | Allowed |
| Records Management: archive | No | Allowed |
| Issuance: create, review, print, correct with reason | Allowed | Allowed |
| Issuance: void/cancel | No | Allowed |
| Issuance: archive and restore (hide, never delete) | No | Allowed |
| Records Management, Barangay IDs tab: list and view | Allowed | Allowed |
| Barangay IDs: create, renew, print (done through Issuance Management, ID document type) | Allowed | Allowed |
| Records Management, Barangay IDs: override validity rules | No | Allowed |
| Records Management, Barangay IDs: set up the ID number series, and type an ID number by hand while the series is on (the same permission, `id.override`, guards all three; no new permission) | No | Allowed |
| Marginalized Sector health condition (value) | Allowed on the single record only; masked in lists; each read is audited | Same |
| Activity Log | Own activity | All users, with filters |
| Notification bell (top bar) | Only notices about their own account: something an administrator did to it (details changed, role changed, password or two-factor or recovery questions reset, unlocked, asked or no longer asked to use two-factor) and their own security events (password changed, two-factor on or off, new codes, recovery questions set, recovery completed, locked after failed sign-ins). Never backups, imports, configuration or other people's accounts | Every notice in the catalog, whoever did it, their own too: accounts, security, backups, imports, configuration. Never residents or issuances |
| My Account, User Settings | Allowed | Allowed |
| Officials, User Accounts | No | Allowed |
| Streets and Tricycle Associations lists (add, rename, remove if unused; `LOOKUPS_MANAGE`) | No | Allowed |
| Lookup lists and officials list (read, for the forms) | Allowed | Allowed |
| Management Reports | No | Allowed |
| Backup and Restore | No; manual-backup permission to confirm | Allowed |

If the client keeps "six accounts, full access", still review whether deletion, export, account administration and sensitive-data access should be restricted **(D-25)**.

### A4. Account status (not needed)

No account `status` column is planned. Accounts are created only by the System Administrator, so there is no pending or rejected state (D-11, decided Nov 7, 2026). The existing `is_active` boolean is enough to disable an account. `/users/signup` stays disabled (`USERS_OPEN_REGISTRATION=False`). Do not add approval endpoints.

### A5. Audit history (design settled Nov 5, 2026; not implemented)

Append-only history for sensitive actions: who, when, affected record, reason where required. Ordinary users cannot rewrite or delete entries; any retention/cleanup must be explicitly controlled and documented. Never log passwords, tokens, reset links or unnecessary resident data **(D-24)**.

Design: an `audit_log` table whose rows cannot be updated or deleted (a database trigger rejects it), written in the same transaction as the change it records. The actor's email is copied into the row so history survives account changes. Columns are in [09](09-Issuance-Form-Data-Map.md). Reading the Marginalized Sector health condition is itself an audited action.

### A6. Account lifecycle

- The system cannot be left without an administrator: the API refuses to demote, deactivate or delete the last active admin.
- A first Staff account can be provisioned the same way with `FIRST_STAFF` and `FIRST_STAFF_PASSWORD` in `.env` (both or neither; created only if missing, never overwritten).
- First administrator is provisioned through controlled initial setup (`FIRST_SUPERUSER` in `.env`). There is **no public sign-up**; an admin creates accounts. The User Accounts table shows whatever the database holds, including this seeded account; it is deployment data, not code. **Before real use, create a real admin in User Accounts, then delete the seed account** (the app refuses to delete the last active admin).
- Use **individual** accounts, not shared ones.
- Disable access when staff leave or no longer need it, while preserving required issuance history. Once records exist, an account that issued a document **cannot be deleted** (the API will answer 409); deactivate it instead. This applies when the issuance tables are built.
- Account setup and password reset by email **will not work offline** (no SMTP). The local procedure is built (owner decision, Nov 7, 2026, **D-12**): the System Administrator creates the account (it starts with the default password `ChangeThisPassword`, no password is typed) or resets another account to that default in User Accounts, and tells the user in person. The default is a known value, so create the account when the person is present; it stops working at the user's first sign-in. A temporary password sets a forced-change flag: the user can sign in, but every page and API operation except reading their own account and changing the password is refused until the password is changed. The user is then signed out and signs in again. No email and no recovery codes. Sign-in events and the `user.temp_password_set` and `user.password_change` events appear in the Activity Log and never contain the password.
- Only the System Administrator creates, disables or re-enables accounts **(D-11)**. Who holds that role in the barangay office is still for the client to name.

---

## Part B. Security controls implemented in the Foundation branch

Implementation, not production approval. CI evidence: all 13 GitHub Actions checks passed on commit `b159e78c…` (Oct 18) and the offline-deployment check passed on later commits (Oct 25). Always check the run for the **exact commit** you are relying on.

- Password recovery attempts are counted in PostgreSQL per normalized email and client IP using keyed HMAC bucket IDs (raw emails/IPs are not stored). Limits are configurable (time window, per-email, per-IP). The endpoint returns a generic response for unknown, throttled and eligible accounts to reduce account enumeration.
- Password-reset and access tokens are bound to the user's current password hash, so a password change or reset invalidates earlier reset links and access tokens. Regression tests cover reset-token reuse and access-token invalidation.
- Password recovery takes the email in a JSON body, not the URL path.
- **Recovery by security questions (step 13, patch 69; works without e-mail).** Each person may choose 3 different questions out of a fixed list of 10 (`q01` to `q10`) and type 3 answers, from the banner under the page header or the **Edit Account** view of My Account; saving needs the current password. Answers are normalised (accents, capital letters, punctuation and extra spaces ignored; at least 2 characters; the 3 answers must differ) and stored only as Argon2 hashes in `security_answers`; the answer text is never stored or logged. On `/recover-password` the person gives the e-mail and answers all 3 questions, then chooses a new password; all 3 answers are always checked and one generic refusal ("The answers were not accepted.") is given, so nobody learns which answer was wrong. An unknown, inactive or not-set e-mail gets 3 decoy questions that are stable per address, so the screen does not reveal which accounts exist. After 5 failed attempts in the window the recovery is locked for 30 minutes (counted from the first failure; HTTP 429) and there is also a per-address-network limit; both are settings (`RECOVERY_QUESTIONS_*`). A successful recovery sets the new password through the normal user update, so old sessions and reset links stop working, and the default password is refused. **Audit:** `auth.recovery_questions_set` (question ids only), `auth.recovery_failed` (known accounts only), `auth.recovery_success`, `auth.recovery_reset_by_admin`. An administrator can clear a staff member's questions in Edit User (not their own); staff cannot. The administrator banner has no "Not now"; staff may press it and the choice is remembered in the browser. Two-factor sign-in (step 14, below) is STILL asked after a recovery by questions.
- **Two-factor sign-in with an authenticator app (step 14, patch 70; optional, works offline).** Each person may turn it on in My Account > Edit Account (it is not forced). After the password, sign-in asks for the 6-digit code from an authenticator app on the phone (Google Authenticator, Microsoft Authenticator, Aegis and similar). Set-up needs the password, shows a QR code drawn in the browser (nothing leaves the computer) and the key in text, shows the server's clock (a phone more than about a minute off gives wrong codes), and turns on only after a correct code; it then shows ten one-time recovery codes once. The secret is stored encrypted with its own key `MFA_ENCRYPTION_KEY` (not `SECRET_KEY`), recovery codes only as hashes. A password alone never opens the system: it returns a 5-minute single-purpose token that every other route refuses. A code works once (replay protection), a recovery code works once, and wrong codes count toward the same lock-out as wrong passwords. Turning it off or making new recovery codes needs the password and a valid code. An administrator can turn off a STAFF person's two-factor in Edit User (lost phone); an administrator's own can only be reset from the server computer with `python -m app.account_recovery_cli` (docs/11 item 9). **Audit:** `auth.mfa_enabled`, `auth.mfa_disabled`, `auth.mfa_failed`, `auth.mfa_recovery_code_used`, `auth.mfa_codes_renewed`, `auth.mfa_reset_by_admin`.
- **Two-factor scope (patch 77; migration `a2d7e4c9b613`).** A banner under the page header (no "Not now") asks every administrator, and every staff member an administrator marked, to turn two-factor on until it is on; it is a request and never blocks a sign-in. An administrator marks or unmarks a STAFF person in Edit User ("Asked to use two-factor": "Ask to use it" / "Stop asking"; not for yourself or another administrator; refused while the server has no `MFA_ENCRYPTION_KEY`). While marked, the person cannot turn two-factor off (`POST /users/me/mfa/disable` answers 409). An administrator reset (`DELETE /users/{id}/mfa`) or the server command does not clear the mark. **Audit:** `auth.mfa_required_set`, `auth.mfa_required_cleared` (only when the value really changes).
- **Notification bell (patch 75; fed by the audit log).** The bell in the top bar reads `GET /api/v1/notifications/`, which turns rows of the append-only `audit_log` into short notices. What a person sees depends on the role (see the access matrix): administrators see the whole catalog, staff only their own account. The last 30 days, newest 50. A notice carries the action, who did it, who it was done to (accounts only) and the time; it never carries the audit `reason` or `details` (a failed backup's server message lives there), file names, record ids, resident names or issuance data, and the temporary password written when an account is created is hidden. Read state is kept per person in the database (`notification_state`, `notification_reads`), so it is the same on every computer. Opening the bell writes no audit row. Rows cannot be cleared, so there is no "Clear all": only "mark as read" and "mark all as read". Two actions are new audit rows for this: `auth.account_locked` (written once, when a sign-in or a wrong two-factor code locks the account), the audit rows `auth.mfa_required_set` and `auth.mfa_required_cleared` of patch 77 are shown too (patch 78: the staff member who is asked sees the notice, other staff do not; administrators see all), and an `is_active` detail on `user.update` (so the bell can say activated or deactivated).
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

**Current status: PENDING.** The hosting design changed on Oct 25 from Vercel + Supabase to a local Docker + PostgreSQL deployment on the office LAN, so the old Vercel/Supabase verification items **no longer apply** and have been removed from this checklist. What remains open is verification of the **actual LAN deployment** — see the acceptance checklist in [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md). The team agreed (Oct 18) to pause further security code changes until the real hosting setup can be inspected; `role` is now implemented and tested through the API; an append-only audit history remains **planned, not started** (no account `status`: D-11) **(D-39)**.
