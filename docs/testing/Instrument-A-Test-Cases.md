# Instrument A — Test Case Form

Filled in by the group. Columns follow the Guide: test no., feature/module, test steps, expected result, actual result, pass/fail, remarks.

**Status:** starter cases only. **No test has been run.** Steps and expected results are drafts to adapt once the real screens exist and the client-approved fields are known. Fictional data only.

Last updated: November 1, 2026

Environment for each run (fill in when testing): date/time (Asia/Manila) · tester · branch and commit · host and browser · internet connected or not.

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
| A-09 | Document issuance and printing | Issue a document for one resident | Issuance saved with its own history entry | | | Printing paused until calibrated (D-17) |
| A-10 | Responsiveness | Open main pages on a phone-width screen (375 px) | Pages usable; tables scroll or collapse | | | Desktop-first (D-29) |
| A-11 | Logout | Log out, then open a protected page by URL or Back button | Redirected to login; protected data not shown | | | |

## B. Additions required by the project's own safeguards

These come from [../05-Roles-Security-and-Privacy.md](../05-Roles-Security-and-Privacy.md) and [../02-Requirements-and-Scope.md](../02-Requirements-and-Scope.md).

| No. | Feature / module | Test steps | Expected result | Actual result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|
| B-01 | Authentication | Call a protected API endpoint with no token | Rejected (401); no data returned | | | |
| B-02 | Authentication | Repeat failed logins past the lockout limit | Lockout applies; behavior matches the documented limit | | | |
| B-03 | Authorization | As Staff, call an admin-only API endpoint directly (not through the UI) | Rejected (403) | | | Needs the backend role model (D-10, D-39) |
| B-04 | Authorization | As Staff, try to change a protected field (role, active status) | Change rejected | | | |
| B-05 | Input validation | Send oversized, empty and unexpected values to a create/update endpoint | Rejected with a safe error; no stack trace or SQL shown | | | |
| B-06 | Document issuance | Issue several documents for the same resident | Each is a separate record; none overwrites another | | | GOAL-02 |
| B-07 | Document issuance | Correct an issued document | A reason is required; the original is preserved; the correction is recorded | | | Correction rules pending (D-26) |
| B-08 | Export | Export a record list (if the feature exists) | Only permitted roles can export; no unnecessary personal data | | | Whether export exists is pending (D-25) |
| B-09 | ID photo upload | Upload a valid image, then a disallowed file type and an oversized file | Valid image accepted; others rejected; nothing is executed | | | |
| B-10 | Backup | Run the backup script with synthetic data | A timestamped dump is created in `backups/` | | | Not yet run on Windows (D-35) |
| B-11 | Restore | Restore the dump onto a clean database | Login, sample records and a document issuance all work afterwards | | | Recorded restore test is required before turnover |
| B-12 | Offline use | Disconnect the internet, use the system from a second office PC over the LAN | Normal workflow works with no internet | | | Needs the real LAN (D-31, D-32) |
| B-13 | Host restart | Reboot the host, sign in, wait for readiness | App and data come back with no data loss | | | Tests the D-34 plan |

## C. Retest log

| Test no. | Failed on | Defect ID (Bug log) | Fixed in commit | Retest date | Retest result |
|---|---|---|---|---|---|
| | | | | | |
