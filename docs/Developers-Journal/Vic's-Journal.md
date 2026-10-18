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
