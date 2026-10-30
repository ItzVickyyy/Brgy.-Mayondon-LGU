# Security Measures Checklist

Use this document as a recurring security checklist for the Barangay Mayondon LGU Web System. Review it during development, before releases, and whenever authentication, data handling, dependencies, infrastructure, or deployment settings change.

This is a checklist, not proof that the system is secure. Record evidence for completed checks and track unresolved risks. Do not mark a check complete merely because the related feature exists.

## How to use this checklist

- [ ] Review relevant checks during each pull request.
- [ ] Run the applicable automated tests and security scans before merging or releasing.
- [ ] Complete the pre-deployment checks before the system handles real client or resident data.
- [ ] Revisit checks after major changes, security incidents, or new client requirements.
- [ ] For each unchecked item, record an owner, next action, and target date in the team's issue tracker or project notes.

**Status labels**

- **Core:** applies to this project regardless of which client features are selected.
- **When applicable:** only required if the system uses that feature or deployment model.
- **Before deployment:** must be verified for the actual hosting and network setup before real users or data are involved.

Until the client interview and Creative Brief confirm the system's modules, roles, and hosting arrangement, do not assume that optional features such as file uploads, public registration, or database row-level security are needed.

## Verified Foundation controls

The following controls are implemented in the Foundation branch and have automated coverage. This list records implementation, not production approval.

- Password recovery attempts are counted in PostgreSQL by normalized email and client IP, using keyed HMAC bucket identifiers rather than storing raw email addresses or IP addresses in the rate-limit table.
- Password recovery limits are configurable by time window, per-email attempt count, and per-IP attempt count. The endpoint keeps a generic response for unknown, throttled, and eligible accounts to reduce account enumeration.
- Password reset tokens and access tokens are bound to the user's current stored password hash. A password change or reset invalidates previously issued reset links and access tokens. Regression tests cover reset-token reuse and access-token invalidation after a reset.
- Password recovery accepts the email in a JSON request body rather than placing it in the URL path. The frontend request client and recovery form use the new body-based contract.
- Administrator-created account emails contain a time-limited password setup link rather than the supplied plaintext password. The link uses the existing password-hash-bound reset token and becomes invalid after the password is changed.
- Expired rate-limit buckets are opportunistically removed during password recovery requests. A database index supports cleanup by window timestamp.
- Check the latest GitHub Actions run for the exact commit before treating CI as passed. This checklist does not certify CI status or production readiness.

Deployment-specific checks remain open until the actual hosting and network design is known. In particular, confirm trusted reverse-proxy configuration before relying on client IP addresses behind a proxy, validate rate-limit behavior in the deployed environment, and review backup/restore, HTTPS, access permissions, and client-approved data-handling procedures before using real resident data.

## 1. Application security

### Secrets and configuration

- [ ] **Core** Keep API keys, passwords, signing keys, tokens, and other secrets out of source code, frontend bundles, screenshots, logs, and documentation.
- [ ] **Core** Review environment files and configuration examples. Commit placeholders only, never real credentials.
- [ ] **Core** Check Git history for accidentally committed secrets, not only the latest files. If a secret was exposed, revoke or rotate it immediately. Removing it from the latest commit is not enough.
- [ ] **Core** Use separate credentials for local development, automated tests, and deployment.
- [ ] **Before deployment** Replace all sample or default credentials and signing keys. Verify that required environment variables are set and unsafe defaults fail clearly.
- [ ] **Before deployment** Confirm that frontend build-time variables contain only values safe to expose to users. Never put server secrets in frontend variables.
- [ ] **Before deployment** Confirm production settings do not enable development-only routes, interactive debugging, or verbose exception output.

### Authentication and authorization

- [ ] **Core** Enforce authentication on the server for every protected API operation. Hiding a page or button in the frontend is not access control.
- [ ] **Core** Protect administrator and staff endpoints with server-side permission checks.
- [ ] **When applicable** Define role-based access control (RBAC) from client-approved roles and responsibilities. Give each role only the permissions it needs.
- [ ] **Core** Check record ownership and scope on every operation that reads, changes, exports, or deletes a record. Do not trust a user-supplied record ID as proof of permission.
- [ ] **Core** Allowlist fields that each role may change. Prevent users from modifying protected fields such as roles, ownership, approval status, or account privileges unless explicitly authorized.
- [ ] **Core** Hash passwords using a suitable password-hashing algorithm and library. Never store or log plaintext passwords.
- [ ] **Core** Use generic login errors that do not reveal whether an account exists. Test login behavior for valid users, invalid passwords, and unknown accounts.
- [ ] **Core** Test failed-login handling and account lockout or throttling so controls cannot be bypassed easily.
- [ ] **When applicable** Rate-limit password reset, account creation, verification, and other sensitive endpoints. Select a method that works with the chosen hosting model and multiple application instances.
- [ ] **When applicable** Add bot protection only if public-facing actions face meaningful automated abuse. Treat it as an additional control, not a replacement for server-side authorization or rate limits.
- [ ] **When applicable** If browser authentication uses cookies, set appropriate Secure, HttpOnly, and SameSite attributes, manage session expiry, and implement CSRF protection for state-changing requests. If bearer tokens are used instead, review token storage, expiry, revocation, and XSS exposure.
- [ ] **Core** Ensure logout and account deactivation invalidate or expire credentials as required by the selected authentication design.
- [ ] **Core** Test authorization with every defined role, including requests made directly to the API rather than through the UI.

## 2. Database and data protection

- [ ] **Core** Use parameterized queries or the ORM's safe query mechanisms. Never build SQL statements by concatenating untrusted input.
- [ ] **Core** Validate request data on the server, including type, length, allowed values, and relationships. Frontend validation is for usability and does not replace server validation.
- [ ] **Core** Return only the fields needed by the caller. Do not expose password hashes, reset tokens, internal secrets, or unnecessary resident information in API responses.
- [ ] **Core** Enforce data ownership and integrity rules in backend logic and database constraints where appropriate. Do not rely only on frontend checks.
- [ ] **Core** Use a database account with only the permissions the application needs. Keep schema migration privileges separate from normal application privileges when the deployment design supports it.
- [ ] **Core** Keep the database and its administration interface inaccessible from the public internet unless access is explicitly required and strongly restricted.
- [ ] **When applicable** Use database row-level security (RLS) only if the chosen database and access design benefit from it. If enabled, test policies for every role and ensure privileged application connections do not unintentionally bypass them.
- [ ] **Before deployment** Protect data in transit with TLS wherever traffic crosses an untrusted network, including connections between the application and database when supported by the deployment.
- [ ] **Before deployment** Confirm how database files, backups, and storage volumes are protected at rest. Use encryption where supported and appropriate to the hosting environment and sensitivity of the data.
- [ ] **Core** Apply data minimization. Collect and retain only the personal information required for client-approved purposes.
- [ ] **Core** Follow the Philippine Data Privacy Act of 2012 and applicable client procedures. Confirm the purpose, access permissions, retention period, correction process, and authorized disclosure of resident data with the client.
- [ ] **When applicable** Review imports, exports, reports, and downloads for unauthorized access or unnecessary personal data.
- [ ] **Before deployment** Back up required data, restrict backup access, and test restoring a backup. A backup that has never been restored is not a verified recovery plan.
- [ ] **Core** Use synthetic or anonymized data for development and automated tests. Do not use real resident records in local development or test environments without explicit authorization and appropriate safeguards.

## 3. Input, browser, and API protections

- [ ] **Core** Prevent cross-site scripting (XSS) by using framework-safe output rendering and avoiding unsafe HTML injection. Validate and sanitize content when the application must accept or render HTML.
- [ ] **Core** Configure Cross-Origin Resource Sharing (CORS) with the specific trusted frontend origins required by the environment. Do not use permissive origins with credentials.
- [ ] **Core** Handle errors safely. Return useful client errors without exposing stack traces, SQL statements, secrets, filesystem details, or internal configuration.
- [ ] **Core** Add suitable security headers for the deployment, such as Content Security Policy where practical, X-Content-Type-Options, and clickjacking protection through CSP frame-ancestors or an appropriate alternative.
- [ ] **When applicable** Protect state-changing cookie-authenticated requests against CSRF. CORS alone is not a CSRF defense.
- [ ] **When applicable** Restrict file uploads by allowed type, size, and count. Do not trust the supplied filename or MIME type alone. Store uploads safely and prevent uploaded files from being executed.
- [ ] **When applicable** Validate redirects and external URLs to prevent unsafe redirects and server-side request forgery (SSRF) if the system fetches user-provided URLs.
- [ ] **Core** Set reasonable request size, pagination, and timeout limits to reduce accidental overload and denial-of-service risk.

## 4. Application, services, and operations

- [ ] **Core** Keep dependencies and base images updated. Review security advisories and upgrade vulnerable packages using a tested change.
- [ ] **Core** Run the application with the least operating-system and database privileges needed. Do not run production services as root unless the platform requires it and the risk is understood.
- [ ] **Before deployment** Disable debug mode and development-only utilities. Confirm that test-user creation and test email endpoints are unavailable in production.
- [ ] **Before deployment** Review Docker Compose and hosting configuration to ensure databases, mail-testing tools, debug ports, and internal services are not unnecessarily exposed.
- [ ] **Before deployment** Enforce HTTPS for public web access, redirect HTTP to HTTPS where appropriate, and verify TLS certificates and renewal.
- [ ] **Before deployment** Review firewall rules, allowed ports, and the client's network setup. Expose only services needed for the agreed architecture.
- [ ] **Core** Keep security-relevant logs for authentication failures, permission denials, administrative actions, and unexpected errors where useful.
- [ ] **Core** Do not log passwords, access tokens, reset links, secret values, or unnecessary personal data. Restrict log access and define a retention period.
- [ ] **Before deployment** Decide who reviews alerts and logs, how incidents are reported, and how credentials can be rotated if exposed.
- [ ] **When applicable** Set service quotas, usage limits, and cost alerts for paid hosting, email, storage, or third-party services.
- [ ] **When applicable** Document recovery steps and verify that the system can be restored after database loss or a failed deployment.

## 5. Security testing and release checks

### During development and pull requests

- [ ] **Core** Run backend tests, frontend tests, integration tests, and relevant end-to-end tests.
- [ ] **Core** Keep automated CI checks passing. Investigate failures instead of bypassing or disabling security-related checks to get a green result.
- [ ] **Core** Test authentication and authorization for allowed and denied requests, including direct API calls.
- [ ] **Core** Test invalid, missing, oversized, and unexpected inputs, including attempts to change protected fields or access another user's records.
- [ ] **Core** Run dependency vulnerability checks and the security scanners available in CI. Review findings rather than assuming every scanner result is correct.
- [ ] **Core** Review changes to authentication, permissions, database migrations, environment configuration, CORS, logging, and deployment files with extra care.
- [ ] **Core** Scan for secrets before pushing and before release. If a secret is found in history, rotate it even if the current file no longer contains it.

### Before a release or client deployment

- [ ] **Before deployment** Verify production configuration using the actual deployment environment, not only local development settings.
- [ ] **Before deployment** Verify HTTPS/TLS, security headers, CORS, and exposed ports from the intended user network.
- [ ] **Before deployment** Test each approved user role and confirm that unauthorized requests are rejected.
- [ ] **Before deployment** Test validation, injection resistance, login throttling, password recovery controls, and session/token behavior where applicable.
- [ ] **Before deployment** Resolve all critical and high-severity security findings, or document the reason, mitigation, approver, and plan before accepting any exception.
- [ ] **Before deployment** Confirm backups and recovery, administrator account ownership, credential handover, and incident contacts.
- [ ] **Before deployment** Document remaining security risks and obtain the required client approval for operational procedures.
- [ ] **Before using real resident data** Confirm the client's data-handling requirements and access rules. Do not assume a passing CI run proves compliance or production readiness.

## 6. Security review record

Complete this record for a release or a scheduled security review.

- Review date:
- Reviewer(s):
- Commit or release reviewed:
- Environment reviewed:
- Checks completed:
- Checks not applicable and reason:
- Findings and severity:
- Fixes or mitigations:
- Accepted risks, approver, and review date:
- Backup and recovery verification:
- Final decision: Not reviewed / Changes required / Approved for testing / Approved for deployment

## 7. Project-specific notes

- The professor-reviewed Creative Brief is the planning baseline. Confirm unresolved account permissions, actual modules, personal data, and operational needs with the client before feature-specific controls are finalized.
- The final hosting choice matters. HTTPS, network exposure, rate limiting, backups, monitoring, and database connectivity must be verified against the actual hosting and Networking 2 setup.
- Keep uncertain starter-template modules until the client requirements confirm whether they are needed. Removing a module is not itself a security measure.
- **Implemented onboarding control:** When email is configured, admin-created account emails use a time-limited setup link and do not include the supplied password. The setup link is based on a password-hash-bound token and is invalidated after a password change. Confirm email delivery and the setup flow in the deployed environment before creating real accounts.
- **Implemented access-token invalidation:** Access tokens include a keyed fingerprint of the current password hash. The API rejects missing or stale fingerprints, so password changes and resets invalidate previously issued tokens. Regression tests cover invalidation after a password reset.
- **Implemented recovery URL privacy control:** The recovery email is accepted in a POST JSON body instead of a URL path. Verify the deployed frontend and backend use the same API version after deployment.
- Passing automated tests means the tested checks passed. It does not guarantee the application is secure or ready for production.


## Project-specific barangay safeguards and LGUSS-BIMS context

On October 27, 2026, the barangay contact told the team that LGUSS-BIMS was old and was no longer being used by the barangay. This is a record of the contact's statement, not confirmation that DILG has discontinued LGUSS-BIMS.

The 2025 DILG memorandum circular on LGUSS-BIMS should inform our thinking about data protection and barangay information management, but this student project is a separate local system. Do not claim that it replaces or integrates with LGUSS-BIMS. No integration or synchronization is in scope unless the client and the appropriate system owner explicitly confirm it and the team documents an approved technical approach.

For the Records and Document Issuance System, include the following in project planning and deployment review:
- [ ] Confirm the client-approved resident data fields and avoid collecting information that is not needed for the agreed workflows.
- [ ] Confirm the six staff accounts' actual permissions with the client, including deletion, export, account administration, and access to sensitive data.
- [ ] Test backend authorization for every protected operation, including direct API requests. Frontend button visibility is not authorization.
- [ ] Identify which record changes and document-issuance actions need an audit trail, and avoid logging unnecessary personal information.
- [ ] Confirm the host computer, LAN/firewall rules, database access, physical access, backup drive custody, and backup schedule.
- [ ] Perform and record a backup restoration test before client turnover.
- [ ] Confirm the process for disabling staff accounts after reassignment, resignation, or loss of need for access.
- [ ] Confirm data purpose, permitted access, retention, correction, disclosure, and incident-reporting procedures with the client, consistent with the Data Privacy Act of 2012 and applicable procedures.
- [ ] Use synthetic or masked resident records for development, testing, screenshots, and class demonstrations unless real-data use is explicitly authorized and appropriately protected.
- [ ] Add authentication, authorization, input-validation, document issuance, export, backup, and restore checks to functional/security testing. Fix failed checks and retest before turnover.

These items are safeguards to implement and verify, not evidence that they are already implemented. Do not claim a formal Privacy Impact Assessment, penetration test, encryption at rest, or compliance certification unless the work was completed and evidence is recorded. See the System Specification and Architecture document for the current client scope and [Offline-LAN-Deployment.md](Offline-LAN-Deployment.md) for deployment-specific checks.

## 8. Final Foundation security review (October 18, 2026)

### Implemented in code and verified by CI
The implementation passed backend tests, Docker Compose checks, frontend lint/build, secret scanning, workflow security checks, and all four Playwright shards on commit `12c171b81c670683e28e3d4428bd02e84c4d93c4`.

- Access-token invalidation after password changes and resets.
- Time-limited password setup links instead of emailing supplied passwords.
- Password recovery email moved from the URL path into a JSON request body.
- Regression tests cover token invalidation, recovery behavior, and account setup email content.

For later commits, check GitHub Actions for the exact commit before treating its checks as passed.

### Production verification remains open
The repository documents Vercel for the frontend/API and Supabase PostgreSQL as the planned hosting setup. The deployment documentation explicitly states that this setup has not yet been tested. The following cannot be marked verified until the actual projects are configured and inspected:

- Confirm the Vercel plan and terms permit the intended LGU use.
- Verify production environment variables, secret strength, and that development-only routes are disabled.
- Verify same-origin routing or exact CORS origins, HTTPS/TLS, security headers, and externally exposed ports.
- Verify Supabase connection-pool settings, database permissions, migration access, backup plan, and a successful restore test.
- Verify password recovery email delivery, rate limiting behind the actual proxy, account setup links, login, logout, and token invalidation against the deployed environment.
- Confirm approved data-handling, access, retention, and incident procedures with the client before entering real resident data.

**Current status: PENDING — production hosting verification has not been performed.**

The team has agreed to keep the current `Foundation` branch, preserve its passing CI, pause additional security code changes, and resume this verification only when the actual hosting setup is available to inspect and test.

- [x] Record the code-level controls above and their test evidence.
- [x] Confirm all 13 CI checks passed for the latest documentation commit `b159e78c9c4504a50d64a4092ff0e75db08d85ce`.
- [ ] Obtain access to, or reliable configuration evidence for, the actual hosting environment.
- [ ] Verify each deployment-specific item above against that environment and record evidence, date, reviewer, and findings in this checklist.
- [ ] Confirm hosting terms, network requirements, and operational/data-handling procedures with the client and instructors before real resident data is used.

**Current decision:** Suitable for continued development and controlled testing only. No further Foundation security code changes are planned at this time. Production verification remains open; passing CI does not prove that the deployed environment is secure. Do not treat production security as verified or enter real resident data until the deployment checks are completed and the required client/instructor approvals are obtained.
