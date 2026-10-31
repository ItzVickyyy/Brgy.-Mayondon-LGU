# Bug and Issue Log

Use this document to record defects, unexpected behavior, test failures, security findings, usability problems, deployment issues, and other issues discovered during development, testing, technology transfer, or launch.

This log is not a substitute for a detailed GitHub issue when discussion, code review, or multiple attachments are needed. Keep entries factual and update their status as work progresses.

## Rules
- Record an issue as soon as practical. Include date, time, and timezone. If the exact time is unknown, say so.
- Assign a unique ID such as BUG-001 or ISSUE-001.
- Record the environment and exact reproduction steps when possible.
- Describe expected and actual behavior separately.
- Set severity based on impact, not how easy the fix appears.
- Only describe a workaround as verified if it has been tested.
- Link related developer-journal entries, commits, pull requests, test cases, or safe screenshots.
- Never attach secrets, passwords, access tokens, or real resident personal data. Use fictional data in examples.
- Do not mark an issue fixed until the fix has been checked and relevant regression tests have passed.
- If a secret was exposed, revoke or rotate it immediately. Never publish its value in this log.

## Severity guide

| Severity | Meaning |
|---|---|
| Critical | Sensitive data is exposed, the system is broadly unavailable, or there is immediate serious risk. Escalate to the project leader immediately. |
| High | A core workflow is blocked, authorization can be bypassed, or significant data loss/corruption is possible. |
| Medium | A feature is impaired or unreliable, but a workaround exists and impact is limited. |
| Low | Minor visual, wording, or usability issue with little effect on core use. |
| Informational | Observation, improvement, or question that is not currently a defect. |

## Status values
New · Triaged · In progress · Blocked · Ready for verification · Closed · Won't fix / Not a bug

## Issue register

| ID | Date and time (timezone) | Summary | Severity | Environment / milestone | Owner | Status | Related link |
|---|---|---|---|---|---|---|---|
| — | — | No issues logged yet | — | — | — | — | — |

## Issue entry template

Copy this section for each issue and add a concise row to the issue register.

### BUG-XXX — Short descriptive title

- **Reported by:**
- **Date and time found:** YYYY-MM-DD HH:MM (Asia/Manila, UTC+08:00)
- **Date and time updated:**
- **Environment:** Local / CI / Test / Staging / Production / Other
- **Project phase or milestone:**
- **Affected area:** Frontend / Backend / Database / API / Authentication / Security / Network / Deployment / Documentation / Other
- **Severity:** Critical / High / Medium / Low / Informational
- **Owner:**
- **Status:** New / Triaged / In progress / Blocked / Ready for verification / Closed / Won't fix / Not a bug

**Summary**  
What is wrong or unexpected?

**Preconditions**  
What needs to be true before the issue can be reproduced?

**Steps to reproduce**
1. 
2. 
3. 

**Expected result**  
What should happen?

**Actual result**  
What happened instead? Include a sanitized error or log excerpt if useful.

**Impact / risk**  
Who or what is affected? Is there any security, privacy, data-integrity, or availability impact?

**Evidence**  
Links to safe screenshots, logs, CI runs, test cases, or a related GitHub issue. Never include secrets or resident data.

**Workaround**  
State a verified workaround or write “None known.”

**Root cause**  
Fill in when confirmed. Do not guess.

**Resolution / fix**  
What changed? Include commit or PR links.

**Verification**
- Test or check performed:
- Result:
- Regression coverage added or updated:
- Verified by:
- Verification date/time:

**Follow-up / prevention**  
What should be done to prevent recurrence, if applicable?

**Related developer journal:** Link the relevant member journal entry.
