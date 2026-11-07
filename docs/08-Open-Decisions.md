# 08 · Open Decisions

The single list of everything that is **undecided, vague or contradictory** across the documentation. Other files tag these as `(D-xx)`.

**How to use:** when a decision is made, (1) write the answer, who decided and when, (2) move the answer into the document it affects, (3) mark the row **Closed** here. Do not delete rows; closed rows are the decision history. Status values: **Open** · **Decided; action pending** (answered, but a code change, test or content is still owed) · **Closed**. Answers are recorded in the [Decision log](#decision-log) below.

**Who decides:** **Client** = Barangay Mayondon · **Instr.** = Prof. Camba / Sir Ramos / Sir Matute · **Team** = the group.
**Needed by:** **V1** = Version 1 demo (Week 15, Nov 2 or 5) · **Test** = testing and technology transfer (Week 16, Nov 9 or 12) · **Data** = before any real resident data · **Final** = final report (Week 18).

Last updated: November 7, 2026

---

## A. Academic and process

| ID | Open question | Why it matters | Who | By | Status |
|---|---|---|---|---|---|
| D-01 | Do we hold the approved **request letter** with instructor signatures and the client's receiving copy? | Required in the final report and Week 13 submission | Team | Final | **Closed** (Nov 1) |
| D-02 | The brief was signed by the **professor**. Does the Guide also require the **client's** signature (the Guide heading says "signed by the client"; the approval block still has blank client/leader lines)? Has the client reviewed and approved the requirements and architecture? | Final report item; approval gate for scope | Instr. / Client | Test | Open |
| D-03 | Bracketed Guide values: mockup pages **[5]**, mobile pages **[2]**, presentation **[15 min]**, survey respondents **[10]**, photos per narrative **[4]**, paper **[A4 / short bond]**, submission **[Google Drive]**, grading weights | Deliverables may be under- or over-scoped | Instr. (Prof. Camba) | V1 | Open |
| D-04 | What do **Sir Ramos** (Networking 2) and **Sir Matute** (Client-Server) require beyond the Guide? | Two of four subjects are unspecified | Instr. | V1 | Open |
| D-05 | **Timeline conflict:** brief says development Nov 1–8 and testing Nov 9–13; the Guide has the Version 1 demo in Week 15 (Nov 2/5) and testing + technology transfer in Week 16 (Nov 9/12). The Guide wins — what exactly must be demoed on Nov 2 or 5? | The demo is days away | Team / Instr. | **V1 (urgent)** | Open |
| D-06 | **Week 14 deliverables** (wireframes, full-color mockups, mobile mockups, one-page style guide, **client feedback**): the docs show a site map, design draft and working style guide but no record of wireframes, mockups or client review. Done? Where are they? | Week 14 is graded (20%) and must be in the report | Team | V1 | **Answered; gap open** (Nov 1) |
| D-07 | Instrument A test cases and the 12 Instrument B survey statements are not in the repo; `Questionnaires.docx` (Filipino interview questions) is referenced but not in the repo | Needed for Week 16; interview evidence for the report | Team | Test | **Decided; content pending** (Nov 1) |
| D-08 | **Branch plan contradiction:** old Source of Truth / README: "keep working on `Foundation`", `Foundation` holds docs. Developers guide + CI: `master` = docs, `draft/admin-portal` = UI. Which is true? Which branch does the demo run from? What is `Foundation` for now? | Wrong branch = failed CI or lost work; the root README is out of date | Team | V1 | **Closed** (Nov 1) |
| D-09 | Broken references: `frontend/src/config/site.ts` points to `docs/ROADMAP.md` (does not exist). Edit lives on `draft/admin-portal` (code), so it can't be fixed from `master`. | Minor | Team | Final | **Decided; code fix pending** (Nov 1) |

## B. Accounts, roles and access

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-10 | Brief: **six staff accounts, all full access.** Prototype: **Staff vs System Administrator** with restrictions. Does the client approve the split? If not, the prototype's role UI and access matrix must be removed or reduced. | Present the matrix to the client (the team already decided to) and record the answer | Client | V1 / Test | Open |
| D-11 | **Staff self-registration with admin approval** vs the brief/README rule of *no public sign-up; admin creates accounts*. Who is the System Administrator and who may approve/disable accounts? | Drop self-registration unless the client asks; admin-created accounts match the brief and need no email | Client / Team | V1 | **Closed** (Nov 7, 2026): owner decided no self-registration, admin creates accounts; UI removed on `draft/admin-portal` (commit "Remove self-registration UI (D-11)"). Not a client approval |
| D-12 | **Account setup and password recovery offline.** Email is disabled, so the reset flow does not work. What is the local procedure (admin sets a temporary password? written recovery code?) and who owns it? | Admin-managed temporary password with forced change | Client / Team | Test | **Closed** (owner decision Nov 7, 2026; implemented Nov 7, 2026). The System Administrator sets a temporary password and gives it to the user in person; the user must change it before accessing other pages or protected API operations. No email or recovery codes. This is not a client approval. |
| D-25 | Even if all six keep "full access": may staff **delete, export, import, manage accounts, back up/restore**? Proposed: staff cannot import, archive, void, or restore | Decide per action, not per person | Client | Test | Open |
| D-39 | Backend authorization is **not implemented** for roles, account status (`pending/active/rejected/inactive`), or audit logging; role is only `is_superuser`. Decide the model, then implement and test direct-API access. | Build after D-10/D-11 are settled. **Account-status part no longer needed** (D-11, Nov 7, 2026: no pending/rejected accounts, no `status` column). Role model (D-10) and audit logging remain; sign-in audit is done | Team | Data | Open (reduced scope) |

## C. Scope, documents and printing

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-13 | **Final document list.** Brief: confirm the list, don't add a document just because a sample exists. Prototype/design also include Damayan, Residency, First-Time Jobseekers. Exact name of the assistance form ("likely Damayan")? | Confirm all 9 types in [04](04-Documents-and-Printing.md) section 2 with the client | Client | V1 | Open |
| D-14 | **Required fields, purposes, sectors, ID types, receipt values, default remarks, "addressed to" wording** per document; the workbook has **different purpose lists** per sheet (`BRGY CLEARANCE` vs `CLEARANCE POSTAL`); issuance metadata and expiry rules per document | Use the `BRGY CLEARANCE` list as provisional | Client | V1 | Open |
| D-15 | **Residency certification:** approved wording, editable text, print as full document or overlay, residency duration entered or calculated | — | Client | Test | Open |
| D-16 | **First-Time Jobseekers:** which parts to generate (applicant sheet, oath, certification), data source, who witnesses; never auto-approve eligibility | — | Client | Test | Open |
| D-17 | **Print specs:** paper/card dimensions, orientation, margins, scaling, printer models, photo size, field coordinates, same settings on every workstation. **Update Nov 5, 2026:** typed-value overlay printing is implemented for six templates with a Printing setup calibration dialog ([04](04-Documents-and-Printing.md) section 6); default positions are estimates and nothing is verified on a real printer. Still needed: blank forms, printer details and the ID card stock, to calibrate the Clearance bottom block and the Franchise and Electrical/Water footer lines. | Get blank forms and printer details first; calibrate with plain paper | Client / Team | Test | Open |
| D-18 | **Barangay ID rules:** numbering series (the `18-128-3597-` prefix is pre-printed), 1-year vs 6-month validity, proof of voter registration and how it's recorded, the separate 2019+ newer-resident list with registered/unregistered remarks, expiry reminders. **Photo:** captured vs uploaded vs from record, dimensions, and **offline background removal** (the client uses an online service today — resident photos must never be uploaded externally). **Update Nov 3, 2026:** the client confirmed photos are taken with a camera at the counter and the background removal should happen in the system. The prototype now has a Take photo step (browser camera) with background removal on the same computer (MediaPipe selfie segmentation, Apache-2.0, about 12 MB, no internet). Photos are needed for Barangay Clearance, First-Time Jobseeker and Barangay ID. **Update Nov 5, 2026:** Upload photo now exists as an alternative, also with local background removal. Still open: photo size, and cut-out quality on the real camera and with a real face photo. The numbering series and the ID card layout moved to D-43 and D-44. | Manual or local tool; no external upload | Client | Test | Open |
| D-19 | **Masterlist import:** field mapping, which fields are truly needed (data minimization), duplicate and outdated record handling, validation, who may import | Preview-and-validate import; fictional data only for development | Client | Test | Open |
| D-20 | **Family / beneficiary / marginalized-sector details:** actual fields and categories, and whether a tab on the resident profile or a separate screen | Tab on the resident profile | Client | V1 | Open |
| D-21 | **Dashboard and reports:** expiry reminder thresholds; which reports (if any) are needed. Management Reports are not in the brief. **Update Nov 5, 2026:** the Reports page now always shows three summary cards (Documents Issued, Records Expiring, Masterlist Imports) at 0 until data exists; which reports are really needed is still open. | Keep only the brief's dashboard; defer reports | Client | V1 | Open |
| D-22 | **Where the purpose list is maintained** now that System Settings was removed, and who may edit it | — | Team / Client | V1 | Open |
| D-23 | **Officials module** (not in the brief). Needed? Signatures stay manual, so what does the system use it for? | Cut it from V1 unless the client asks | Client | V1 | Open |
| D-24 | **Audit / activity log:** which actions must be recorded, who reviews it, retention. Not in the brief. | Record issuance, corrections, imports, account changes | Client / Team | Data | Open |
| D-26 | **Deletion vs archive; corrections; retention periods** for records and issuance history | Archive instead of delete; corrections require a reason | Client | Data | Open |
| D-27 | The public `/welcome` page with placeholder announcements and contact details is **out of scope** yet still exists | Remove or reduce to a staff-oriented start page | Team | V1 | **Decided; code change pending** (Nov 1) |
| D-28 | **Look and feel:** brief says Arial; the style guide says framework default font; palette (navy `#0C2F52`, white, light gray) is "suggested". Confirm brand colors, font, print styling and logo rules with the client. | Arial + navy palette, confirmed in the design review | Client | V1 | Open |
| D-29 | **Mobile:** users are office staff on office computers; the Guide still asks for mobile mockups. Is a phone view needed beyond the Guide's requirement? | Responsive, but don't prioritize | Team | V1 | **Closed** (Nov 1) |
| D-43 | **Barangay ID numbering:** the barangay's current numbering series and the rule for assigning the next number (Records Management has no Create button; the number would be assigned on issue). Related to D-18. | Ask for the existing list and who assigns numbers today | Client | Test | Open |
| D-44 | **Approved ID card layout:** photo placement, print scaling and card size. No ID card layout file exists in the repo, so Barangay ID has no print template. Related to D-17. | Get a physical card and the Publisher layout | Client | Test | Open |
| D-45 | **"Print" on an ID row:** should it reprint an existing ID, or start a new issuance as it does now (it opens New Issuance for the ID type)? | Keep starting a new issuance until D-44 is settled | Client / Team | Test | Open |
| D-46 | **Real barangay contact email.** `frontend/src/config/barangay-profile.ts` holds `barangay.mayondon@example.com` with a "TODO confirm with barangay" comment. No example addresses may appear in placeholders (see [10](10-Decisions-Already-Made.md)). | Ask the barangay for the official address | Client | V1 | Open |
| D-47 | **Client-approved dark/light palette.** Dark mode was changed in Nov 2026 (new `brand` token, lighter dark `primary`) for contrast, not from a client brief; not checked in a real browser in both modes. Related to D-28. | Show both modes to the client and record the answer in [03](03-Design-and-UI.md) section 5 | Client | Test | Open |

## D. Deployment, backup and operations

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-30 | **Handover and ownership:** what source code, deployment files, docs, maintenance support and usage rights are given to the client; the repo is MIT-licensed from the template | Record the agreed arrangement in writing | Client / Instr. | Test | Open |
| D-31 | **Host computer:** which PC, its OS (docs assume Windows 10/11) and specs, who owns it, and how it handles **night-duty staff** (host must be on) and being used as a clerk workstation | — | Client | Test | Open |
| D-32 | **LAN:** are all PCs on one network, is there a router that can reserve the host's IP, firewall rules, printer sharing, who administers the network | — | Client | Test | Open |
| D-33 | **HTTPS vs HTTP on the LAN** (currently unencrypted); protection of data at rest including backups | Document the risk decision with the client | Team / Client | Data | Open |
| D-34 | **Startup:** Docker Desktop starting at Windows sign-in vs before sign-in; Docker Desktop licence terms for the client's use; whether another way to run containers is better | Test the real boot sequence on the host | Team | Test | **Decided; verification pending** (Nov 1) |
| D-35 | **Backup:** the brief requires **scheduled and manual** backups to an **external drive.** Only manual scripts exist and none has been run on Windows. Decide frequency, scheduling method, drive custody, retention, backup protection, who restores, and complete a recorded restore test. | Daily scheduled + manual before big changes; drive kept by a named person | Client / Team | Test | Open |
| D-36 | **Maintenance after turnover:** who restarts, updates, supports, and responds to incidents; support contact | Name one client contact and one student/maintainer | Client | Test | Open |
| D-37 | The API docs page (`/docs`) loads CDN assets and won't render fully offline. Needed offline? | Not needed for staff; package assets only if required | Team | Final | **Closed** (Nov 1) |
| D-38 | **Data Privacy Act procedures:** purpose, access, retention, correction, disclosure and incident handling as approved by the barangay; any privacy notice or consent wording | Ask whether the barangay has existing procedures | Client | Data | Open |
| D-40 | **Real-data gate:** exactly what approvals (client + instructor) and passing checks must exist before real resident data is entered. Until then, synthetic data only. | See [05](05-Roles-Security-and-Privacy.md) Part D | Client / Instr. | Data | Open |
| D-41 | **Testing participants:** who evaluates (Instrument B needs about [10] respondents including the client), when, and who can take part in staff training | Six staff + client head + admin assistant | Client / Team | Test | Open |
| D-42 | **Certificate of Utilization:** name and position of the client's head who signs; whether the barangay has letterhead; the date of turnover | — | Client | Test | Open |

---

## Inconsistencies fixed while merging

For the record, these contradictions were found and resolved in the merged files:

| Where | Problem | Resolution |
|---|---|---|
| Old Security-Measures, section 8 | Described **Vercel + Supabase** as the planned hosting | Replaced with a note that hosting changed to local Docker; old items removed; LAN verification is the open item |
| Old Source of Truth | Heading said the brief is "signed by the client"; body said the professor signed | Both facts kept; flagged as D-02 |
| Old System Specification | Still said the sitemap, ERD and client approval were "pending"/"not defined" and used the old template sitemap | Sitemap is in [03](03-Design-and-UI.md); ERD remains undone (see below) |
| Old Vic's journal (Oct 25) | Said the brief was unsigned | Journal since removed (Nov 1, 2026); current state is in [01](01-Project-and-Schedule.md) |
| Old Admin Portal Draft | Described the original dashboard (population, households, voters) | Replaced by the Nov 1 version (documents issued and expiries) |
| Old Site Map doc | Two sections numbered 10 and two numbered 11; "Sample Data" badges described as both present and removed | Renumbered and merged; badges removed per the Nov 1 team decision |
| Old Source of Truth status | Status checklist ticked the public `/welcome` page as an achievement although the design says to remove public content | Reframed as a prototype item; D-27 |
| Old README / How-To-Start | Told developers to be on `Foundation` | Kept as part of D-08 |
| Old Creative Brief vs design docs | "No public sign-up" vs "Request Access" | D-11 |

## Still missing from the documentation (not just undecided)

- **Database design / ERD.** Neither the spec nor the code docs define the resident, ID, issuance and request entities. Needed for Version 1; depends on D-13, D-14, D-18, D-19, D-20.
- **Wireframes, full-color mockups, mobile mockups and client feedback** (D-06). **Not produced.** No Figma/Canva design exists; the design was coded directly as the `draft/admin-portal` prototype.
- **Interview notes and attendance sheets** for the report appendices (the notes live in the group's separate interview document).
- **Instrument A test cases and Instrument B statements** (D-07). Starter files now exist in [`testing/`](testing/README.md); the 12 survey statements must still be copied from the Final Project Guide.
- **User manual** — blocked until the system is deployable; outline is in [01](01-Project-and-Schedule.md) and [06](06-Architecture-and-Deployment.md).

## Decision log

Answers to items above, recorded when made. Decision maker is the project team unless stated.

### Nov 1, 2026 — team decisions

| ID | Decision | Moved into | Still owed |
|---|---|---|---|
| D-01 | The team holds the approved request letter with instructor signatures and the client's receiving copy. Treated as done; no further tracking. | [01](01-Project-and-Schedule.md) §5 | Nothing (include the letter in the final report as item 3) |
| D-06 | **Answered: the Week 14 artifacts were not produced.** No wireframes, full-color mockups, mobile mockups or client feedback exist, and no Figma/Canva design was made. The design was built directly in code as the `draft/admin-portal` branch (hence "draft"). The site map and style guide exist in [03](03-Design-and-UI.md). | [01](01-Project-and-Schedule.md) §11, [03](03-Design-and-UI.md) §6 and §8 | See *D-06 follow-up* below. Question stays open until the instructor and client have seen the prototype |
| D-07 | Test instruments live in `docs/testing/` on `master`: one file for Instrument A, one for Instrument B. | [01](01-Project-and-Schedule.md) §7, new [`testing/`](testing/README.md) | The 12 Instrument B statements (copy from the Final Project Guide, not invented); `Questionnaires.docx` is still not in the repo |
| D-08 | `master` = docs and planning. `draft/admin-portal` = UI and supporting code, and **the Version 1 demo runs from it**. `Foundation` is frozen as a read-only reference (it contains no commit that `master` lacks as of Nov 1; verify before relying on this). Nothing is renamed, merged or deleted. The planned `production` branch is still not created. | [07](07-Developer-Guide.md) §4, root `README.md` | Nothing |
| D-09 | `site.ts` points to a missing `docs/ROADMAP.md`. Fix it in the next code commit on `draft/admin-portal`. Low priority. | This row | Code change on `draft/admin-portal` |
| D-27 | The public `/welcome` page with placeholder announcements and contact details is removed from the product direction. Entry goes to staff login. No placeholder contact details are shown as facts. | [03](03-Design-and-UI.md) §6 and §7 | Code change on `draft/admin-portal` |
| D-29 | Responsive layouts, desktop-first, phone view not prioritized. Only the phone mockups the Guide requires (count pending, D-03). | [03](03-Design-and-UI.md) §5 | Nothing |
| D-34 | Plan for Docker Desktop starting at Windows **sign-in**; the user manual states that staff or the host user must sign in first. No promise of availability before sign-in until a real reboot test succeeds. Check Docker Desktop licence terms for the client's use. Evaluate another container runtime only if the boot test fails. | [06](06-Architecture-and-Deployment.md) §4 and §11 | Real reboot test on the host (needs D-31); licence check |
| D-37 | The `/docs` API page is not needed offline. Leave it as is; package its assets only if wanted for a demo. | [06](06-Architecture-and-Deployment.md) §9 | Nothing |

### Nov 5, 2026 - design and scope changes by the project owner

These were made in code on `draft/admin-portal` and are recorded as settled in [10-Decisions-Already-Made.md](10-Decisions-Already-Made.md). They answer no numbered question above, but they change the rows noted: PhilHealth Certification removed (touches D-13); Purpose note and Referred by (c/o) removed from the form and print (touches D-14 and D-23); Barangay IDs merged into Records Management and issued through Issuance Management (touches D-18); dark-mode `brand` token added (opens D-47). New open questions: D-43 to D-47.

### D-06 follow-up (proposed, not yet decided)

The Guide requires Week 14 deliverables, and Week 14 counts toward a graded 20%. A coded prototype may or may not be accepted in place of them. Proposed steps:

1. Ask Prof. Camba whether the coded `draft/admin-portal` prototype satisfies the Week 14 design deliverable or whether the separate artifacts are still required (add to the D-03 questions).
2. If artifacts are required, produce them from the prototype rather than redesigning: screenshots as the full-color mockups (the **[5]** main pages and the **[2]** mobile pages), a one-page style guide from [03](03-Design-and-UI.md) §5, and simple wireframes if the instructor insists. Use fictional data only.
3. Show the prototype to the client and record their comments and the changes made. This is the evidence that is currently missing, and it also closes D-10, D-11, D-13, D-20 and D-23 if those are put to the client at the same time.
