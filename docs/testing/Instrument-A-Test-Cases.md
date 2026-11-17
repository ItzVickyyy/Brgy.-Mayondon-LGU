# Instrument A — Test Case Form

Filled in by the group. Columns follow the Guide: test no., feature/module, test steps, expected result, actual result, pass/fail, remarks.

**Status:** starter cases only. **No test has been run.** Steps and expected results are drafts to adapt to the screens as they now exist and to the client-approved fields. Fictional data only.

Last updated: November 18, 2026

Environment for each run (fill in when testing): date/time (Asia/Manila) · tester · branch and commit · host and browser · internet connected or not · seeded fictional data or a clean database.

Roles used below: **Admin** is the System Administrator; **Staff** is a staff account. Whether the Admin/Staff split is approved is still open (D-10, D-25), so the expected results for Staff may change.

## A. Starter cases from the Guide

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| A-01 | Login | Enter a correct email and password | Signed in; dashboard opens | | | |
| A-02 | Login | Enter a correct email and a wrong password | Generic error; not signed in; no hint whether the account exists | | | |
| A-03 | Resident record: add | Fill all required fields with valid fictional data, save | Record saved and appears in search | | | Required fields pending D-14, D-19 |
| A-04 | Resident record: add | Leave a required field empty, save | Save blocked; clear message on the missing field | | | |
| A-05 | Search | Search for an existing fictional resident | Matching record found | | | Search fields pending client confirmation |
| A-06 | Search | Search for a name that does not exist | Clear "no results" state; no error | | | |
| A-07 | Resident record: edit | Change a field, save | Change saved and shown on reopening | | | |
| A-08 | Delete / archive | Archive a record | Confirmation asked first; record archived, not permanently deleted | | | Archive-not-delete proposed (D-26) |
| A-09 | Document issuance and printing | Issue a document for one resident, then print it | Issuance saved with its own history entry; printout lines up with the form | | | Print positions are estimates until calibrated on the real printer (D-17) |
| A-10 | Responsiveness | Open main pages on a phone-width screen (375 px) | Pages usable; tables scroll or collapse | | | Desktop-first (D-29) |
| A-11 | Logout | Log out, then open a protected page by URL or Back button | Redirected to login; protected data not shown | | | |

## B. Additions required by the project's own safeguards

These come from [../05-Roles-Security-and-Privacy.md](../05-Roles-Security-and-Privacy.md) and [../02-Requirements-and-Scope.md](../02-Requirements-and-Scope.md).

### B1. Authentication and accounts

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| B-01 | Authentication | Call a protected API endpoint with no token | Rejected (401); no data returned | | | |
| B-02 | Authentication | Repeat failed logins past the lockout limit | Account locks; matches the documented limit; the person sees a notice in the bell | | | |
| B-03 | Authentication | Sign in with the default or a weak password when changing a password | Default password refused; weak password refused with a clear message | | | |
| B-04 | Two-factor sign-in | Turn on two-factor for a test account, sign out, sign in with a valid code, then with a wrong code | Valid code signs in; wrong code is refused; repeated wrong codes lock the account | | | Never write a real code or secret in this sheet |
| B-05 | Password recovery | Use "recover password" with the 3 security answers for a test account | New password accepted; one generic refusal when any answer is wrong; unknown e-mail gets the same kind of screen | | | Two-factor is still asked afterward |
| B-06 | Sessions | Change a password, then use the old session or reset link | Old session and reset links stop working | | | |

### B2. Authorization

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| B-07 | Authorization | As Staff, call an admin-only API endpoint directly (not through the UI) | Rejected (403) | | | Role model: D-10, D-39 |
| B-08 | Authorization | As Staff, try to change a protected field (role, active status) of any account | Change rejected | | | |
| B-09 | Authorization | As Staff, open the Backup and Restore, Activity Log and account-management pages by URL | Not available to Staff; nothing leaks in the page or the API reply | | | Per the access matrix in docs/05 |
| B-10 | Notification bell | As Staff, open the bell after an admin changes that account | Staff sees only notices about their own account; no backups, imports or other people's accounts | | | |

### B3. Data handling and issuance

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| B-11 | Input validation | Send oversized, empty and unexpected values to a create/update endpoint or form | Rejected with a safe error; no stack trace or SQL shown | | | |
| B-12 | Document issuance | Issue several documents for the same resident | Each is a separate record; none overwrites another | | | GOAL-02 |
| B-13 | Document issuance | Correct an issued document | A reason is required; the original is preserved; the correction is recorded | | | Correction rules pending (D-26) |
| B-14 | Document issuance | Switch resident or document type in the middle of a draft issuance | The draft does not carry over the other resident's details | | | Draft-switch behaviour |
| B-15 | Masterlist import | Preview-and-validate a fictional import file with one valid row, one duplicate and one invalid row | Preview flags the duplicate and the invalid row; nothing is saved until confirmed | | | Who may import is pending (D-19, D-25) |
| B-16 | Export | Export a record list (if the feature exists) | Only permitted roles can export; no unnecessary personal data | | | Whether export exists is pending (D-25) |
| B-17 | ID photo upload | Upload a valid image, then a disallowed file type and an oversized file | Valid image accepted; others rejected; nothing is executed | | | |
| B-18 | Activity Log | Perform a sign-in, a record change and an issuance, then open the Activity Log as Admin | Each action appears with who and when; no passwords, codes or recovery answers are shown; rows cannot be edited or deleted | | | |

### B4. Backup, offline use and restart

These need the real host. Step-by-step instructions and the result sheet are in [../11-Host-Checks.md](../11-Host-Checks.md); copy each outcome here.

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| B-19 | Backup | Press **Back up now** with synthetic data | A verified, timestamped dump (encrypted when the public key is present) appears in `backups\` | | | docs/11 section A; run on Windows hosts Nov 15–16, 2026 |
| B-20 | Scheduled backup | Register the task, start it by hand, then leave it two days | `last-run.json` shows `ok: true`; one new scheduled backup per day; no more than the kept number of copies | | | The first unattended daily run has not been reported yet |
| B-21 | Restore | Restore a dump onto a clean database with `restore-db.ps1` | Login, sample records and a document issuance all work afterwards | | | `restore-db.ps1` not yet run on a Windows host; recorded restore test required before turnover |
| B-22 | Offline use | Disconnect the internet, use the system from a second office PC over the LAN | Normal workflow works with no internet | | | Needs the real LAN (D-31, D-32) |
| B-23 | Host restart | Reboot the host, sign in, wait for readiness | App and data come back with no data loss | | | Tests the D-34 plan |

## C. Retest log

| Test no. | Failed on | Defect reference | Fixed in commit | Retest date | Retest result |
|---|---|---|---|---|---|
| | | | | | |
