# 08 · Open Decisions

The single list of everything that is **undecided, vague or contradictory** across the documentation. Other files tag these as `(D-xx)`.

**How to use:** when a decision is made, (1) write the answer, who decided and when, (2) move the answer into the document it affects, (3) mark the row **Closed** here. Do not delete rows; closed rows are the decision history.

**Who decides:** **Client** = Barangay Mayondon · **Instr.** = Prof. Camba / Sir Ramos / Sir Matute · **Team** = the group.
**Needed by:** **V1** = Version 1 demo (Week 15, Nov 2 or 5) · **Test** = testing and technology transfer (Week 16, Nov 9 or 12) · **Data** = before any real resident data · **Final** = final report (Week 18).

Last updated: November 1, 2026

---

## A. Academic and process

| ID | Open question | Why it matters | Who | By | Status |
|---|---|---|---|---|---|
| D-01 | Do we hold the approved **request letter** with instructor signatures and the client's receiving copy? | Required in the final report and Week 13 submission | Team | Final | Open |
| D-02 | The brief was signed by the **professor**. Does the Guide also require the **client's** signature (the Guide heading says "signed by the client"; the approval block still has blank client/leader lines)? Has the client reviewed and approved the requirements and architecture? | Final report item; approval gate for scope | Instr. / Client | Test | Open |
| D-03 | Bracketed Guide values: mockup pages **[5]**, mobile pages **[2]**, presentation **[15 min]**, survey respondents **[10]**, photos per narrative **[4]**, paper **[A4 / short bond]**, submission **[Google Drive]**, grading weights | Deliverables may be under- or over-scoped | Instr. (Prof. Camba) | V1 | Open |
| D-04 | What do **Sir Ramos** (Networking 2) and **Sir Matute** (Client-Server) require beyond the Guide? | Two of four subjects are unspecified | Instr. | V1 | Open |
| D-05 | **Timeline conflict:** brief says development Nov 1–8 and testing Nov 9–13; the Guide has the Version 1 demo in Week 15 (Nov 2/5) and testing + technology transfer in Week 16 (Nov 9/12). The Guide wins — what exactly must be demoed on Nov 2 or 5? | The demo is days away | Team / Instr. | **V1 (urgent)** | Open |
| D-06 | **Week 14 deliverables** (wireframes, full-color mockups, mobile mockups, one-page style guide, **client feedback**): the docs show a site map, design draft and working style guide but no record of wireframes, mockups or client review. Done? Where are they? | Week 14 is graded (20%) and must be in the report | Team | V1 | Open |
| D-07 | Instrument A test cases and the 12 Instrument B survey statements are not in the repo; `Questionnaires.docx` (Filipino interview questions) is referenced but not in the repo | Needed for Week 16; interview evidence for the report | Team | Test | Open |
| D-08 | **Branch plan contradiction:** old Source of Truth / README: "keep working on `Foundation`", `Foundation` holds docs. Developers guide + CI: `master` = docs, `draft/admin-portal` = UI. Which is true? Which branch does the demo run from? What is `Foundation` for now? | Wrong branch = failed CI or lost work; the root README is out of date | Team | V1 | Open |
| D-09 | Broken references: `frontend/src/config/site.ts` points to `docs/ROADMAP.md` (does not exist). Edit lives on `draft/admin-portal` (code), so it can't be fixed from `master`. | Minor | Team | Final | Open |

## B. Accounts, roles and access

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-10 | Brief: **six staff accounts, all full access.** Prototype: **Staff vs System Administrator** with restrictions. Does the client approve the split? If not, the prototype's role UI and access matrix must be removed or reduced. | Present the matrix to the client (the team already decided to) and record the answer | Client | V1 / Test | Open |
| D-11 | **Staff self-registration with admin approval** vs the brief/README rule of *no public sign-up; admin creates accounts*. Who is the System Administrator and who may approve/disable accounts? | Drop self-registration unless the client asks; admin-created accounts match the brief and need no email | Client / Team | V1 | Open |
| D-12 | **Account setup and password recovery offline.** Email is disabled, so the reset flow does not work. What is the local procedure (admin sets a temporary password? written recovery code?) and who owns it? | Admin-managed temporary password with forced change | Client / Team | Test | Open |
| D-25 | Even if all six keep "full access": may staff **delete, export, import, manage accounts, back up/restore**? Proposed: staff cannot import, archive, void, or restore | Decide per action, not per person | Client | Test | Open |
| D-39 | Backend authorization is **not implemented** for roles, account status (`pending/active/rejected/inactive`), or audit logging; role is only `is_superuser`. Decide the model, then implement and test direct-API access. | Build after D-10/D-11 are settled | Team | Data | Open |

## C. Scope, documents and printing

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-13 | **Final document list.** Brief: confirm the list, don't add a document just because a sample exists. Prototype/design also include Damayan, Residency, First-Time Jobseekers. Exact name of the assistance form ("likely Damayan")? | Confirm all 9 types in [04](04-Documents-and-Printing.md) section 2 with the client | Client | V1 | Open |
| D-14 | **Required fields, purposes, sectors, ID types, receipt values, default remarks, "addressed to" wording** per document; the workbook has **different purpose lists** per sheet (`BRGY CLEARANCE` vs `CLEARANCE POSTAL`); issuance metadata and expiry rules per document | Use the `BRGY CLEARANCE` list as provisional | Client | V1 | Open |
| D-15 | **Residency certification:** approved wording, editable text, print as full document or overlay, residency duration entered or calculated | — | Client | Test | Open |
| D-16 | **First-Time Jobseekers:** which parts to generate (applicant sheet, oath, certification), data source, who witnesses; never auto-approve eligibility | — | Client | Test | Open |
| D-17 | **Print specs:** paper/card dimensions, orientation, margins, scaling, printer models, photo size, field coordinates, same settings on every workstation. **Printing is paused** until calibrated. Physical blank forms and the ID card stock needed. | Get blank forms and printer details first; calibrate with plain paper | Client / Team | Test | Open |
| D-18 | **Barangay ID rules:** numbering series (the `18-128-3597-` prefix is pre-printed), 1-year vs 6-month validity, proof of voter registration and how it's recorded, the separate 2019+ newer-resident list with registered/unregistered remarks, expiry reminders. **Photo:** captured vs uploaded vs from record, dimensions, and **offline background removal** (the client uses an online service today — resident photos must never be uploaded externally). | Manual or local tool; no external upload | Client | Test | Open |
| D-19 | **Masterlist import:** field mapping, which fields are truly needed (data minimization), duplicate and outdated record handling, validation, who may import | Preview-and-validate import; fictional data only for development | Client | Test | Open |
| D-20 | **Family / beneficiary / marginalized-sector details:** actual fields and categories, and whether a tab on the resident profile or a separate screen | Tab on the resident profile | Client | V1 | Open |
| D-21 | **Dashboard and reports:** expiry reminder thresholds; which reports (if any) are needed. Management Reports are not in the brief. | Keep only the brief's dashboard; defer reports | Client | V1 | Open |
| D-22 | **Where the purpose list is maintained** now that System Settings was removed, and who may edit it | — | Team / Client | V1 | Open |
| D-23 | **Officials module** (not in the brief). Needed? Signatures stay manual, so what does the system use it for? | Cut it from V1 unless the client asks | Client | V1 | Open |
| D-24 | **Audit / activity log:** which actions must be recorded, who reviews it, retention. Not in the brief. | Record issuance, corrections, imports, account changes | Client / Team | Data | Open |
| D-26 | **Deletion vs archive; corrections; retention periods** for records and issuance history | Archive instead of delete; corrections require a reason | Client | Data | Open |
| D-27 | The public `/welcome` page with placeholder announcements and contact details is **out of scope** yet still exists | Remove or reduce to a staff-oriented start page | Team | V1 | Open |
| D-28 | **Look and feel:** brief says Arial; the style guide says framework default font; palette (navy `#0C2F52`, white, light gray) is "suggested". Confirm brand colors, font, print styling and logo rules with the client. | Arial + navy palette, confirmed in the design review | Client | V1 | Open |
| D-29 | **Mobile:** users are office staff on office computers; the Guide still asks for mobile mockups. Is a phone view needed beyond the Guide's requirement? | Responsive, but don't prioritize | Team | V1 | Open |

## D. Deployment, backup and operations

| ID | Open question | Suggested starting point | Who | By | Status |
|---|---|---|---|---|---|
| D-30 | **Handover and ownership:** what source code, deployment files, docs, maintenance support and usage rights are given to the client; the repo is MIT-licensed from the template | Record the agreed arrangement in writing | Client / Instr. | Test | Open |
| D-31 | **Host computer:** which PC, its OS (docs assume Windows 10/11) and specs, who owns it, and how it handles **night-duty staff** (host must be on) and being used as a clerk workstation | — | Client | Test | Open |
| D-32 | **LAN:** are all PCs on one network, is there a router that can reserve the host's IP, firewall rules, printer sharing, who administers the network | — | Client | Test | Open |
| D-33 | **HTTPS vs HTTP on the LAN** (currently unencrypted); protection of data at rest including backups | Document the risk decision with the client | Team / Client | Data | Open |
| D-34 | **Startup:** Docker Desktop starting at Windows sign-in vs before sign-in; Docker Desktop licence terms for the client's use; whether another way to run containers is better | Test the real boot sequence on the host | Team | Test | Open |
| D-35 | **Backup:** the brief requires **scheduled and manual** backups to an **external drive.** Only manual scripts exist and none has been run on Windows. Decide frequency, scheduling method, drive custody, retention, backup protection, who restores, and complete a recorded restore test. | Daily scheduled + manual before big changes; drive kept by a named person | Client / Team | Test | Open |
| D-36 | **Maintenance after turnover:** who restarts, updates, supports, and responds to incidents; support contact | Name one client contact and one student/maintainer | Client | Test | Open |
| D-37 | The API docs page (`/docs`) loads CDN assets and won't render fully offline. Needed offline? | Not needed for staff; package assets only if required | Team | Final | Open |
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
| Old Vic's journal (Oct 25) | Said the brief was unsigned | Left as historical record; current state is in [01](01-Project-and-Schedule.md) |
| Old Admin Portal Draft | Described the original dashboard (population, households, voters) | Replaced by the Nov 1 version (documents issued and expiries) |
| Old Site Map doc | Two sections numbered 10 and two numbered 11; "Sample Data" badges described as both present and removed | Renumbered and merged; badges removed per the Nov 1 team decision |
| Old Source of Truth status | Status checklist ticked the public `/welcome` page as an achievement although the design says to remove public content | Reframed as a prototype item; D-27 |
| Old README / How-To-Start | Told developers to be on `Foundation` | Kept as part of D-08 |
| Old Creative Brief vs design docs | "No public sign-up" vs "Request Access" | D-11 |

## Still missing from the documentation (not just undecided)

- **Database design / ERD.** Neither the spec nor the code docs define the resident, ID, issuance and request entities. Needed for Version 1; depends on D-13, D-14, D-18, D-19, D-20.
- **Wireframes and full-color mockups** (D-06).
- **Interview notes and attendance sheets** for the report appendices (the notes live in the group's separate interview document).
- **Instrument A test cases and Instrument B statements** (D-07).
- **User manual** — blocked until the system is deployable; outline is in [01](01-Project-and-Schedule.md) and [06](06-Architecture-and-Deployment.md).
