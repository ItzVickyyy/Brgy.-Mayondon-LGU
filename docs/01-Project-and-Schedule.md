# 01 · Project and Schedule

The reference for **what the project is, who is on it, what the instructors require, and where we stand**. Client requirements are in [02-Requirements-and-Scope.md](02-Requirements-and-Scope.md). Anything still undecided is tracked in [08-Open-Decisions.md](08-Open-Decisions.md) and tagged `(D-xx)` below.

**Precedence if documents conflict:** (1) the instructor's *Final Project Guide* → (2) the signed Creative Brief for client scope → (3) this documentation set. When a conflict is found, fix the lower-ranked document.

**Using a free AI assistant:** paste this file at the start of a new chat, add the other file you need, then ask. Never paste passwords, `.env` contents, secrets, or real resident data.

Last updated: November 1, 2026

---

## 1. Project at a glance

| | |
|---|---|
| Project | A working web system for a real client, designed, built, tested and turned over by one group |
| Client | Barangay Mayondon LGU, Los Baños, Laguna (assigned by Prof. Camba) |
| System | **Barangay Mayondon Records and Document Issuance System** |
| Scope source | Client interviews on October 19–20, 2026, defined in the final Creative Brief (signed by the professor) |
| Operating model | Client prefers a fully offline system on the barangay office's local network. A Docker-based local-host path is prepared; the actual LAN setup, offline workflows, backup/restore and client approval are **unverified** |
| School / program | Laguna State Polytechnic University – Los Baños Campus · BSIT, Major in Web and Mobile Application Development (WMAD), Section 3A |
| Merged courses | One project replaces the separate final projects of four subjects |

**Project rules**

- Build 3–4 modules that fully work rather than many half-finished ones.
- Never invent client facts or requirements; ask the client.
- Residents' personal data is sensitive (Data Privacy Act of 2012): least-privilege access, no real data or secrets in git, no real data in class demos.

## 2. Team

| Member | Role | Suggested focus (not exclusive) |
|---|---|---|
| Vic John O. Salen Jr. | Project Leader, Full Stack Developer (also fills out the Peer Evaluation Sheet) | Coordination, architecture, authentication/roles, deployment, integration, final demo |
| Justin Adrian P. Reboton | Backend Developer, Technical Writer | Backend logic, models, migrations, APIs, tests; Creative Brief, user manual and final report writing |
| Jean Mervin G. Fajardo | Full Stack Developer | UI/UX, sitemap, wireframes, mockups, responsive interface, frontend and API integration |

Vic and Jean are both full-stack and coordinate frontend/backend tasks by workload and experience. Areas of focus are ownership, not permission to ignore other code; discuss anything that affects another person's work first. Every member must be able to explain and defend what they implement.

## 3. Subjects and what each one assesses

| Course | Instructor | Focus of assessment |
|---|---|---|
| ITST301 Principles of Web Design | Merardo Arenas Camba, Jr. | Client requirements, Creative Brief, UI/UX, layout, responsiveness, usability |
| Integrative Programming | Mike Philip Ramos | Back-end logic, database, integration of system modules |
| Client-Server Technologies | Alejandro V. Matute Jr. | Client-server setup, deployment, data exchange |
| Networking 2 | Mike Philip Ramos | Network setup, connectivity and security at the client's site |

The *Final Project Guide* is written by Prof. Camba (ITST301) and gives the ITST301 grading. The other three subjects may have their own requirements, which are not yet confirmed with Sir Ramos and Sir Matute **(D-04)**.

## 4. Schedule (2026)

Each milestone is checked in class. A group that falls behind should book a consultation immediately (Google Calendar, merardo.camba@lspu.edu.ph) and tell Vic early.

| Week | Dates | Milestone | Submit or show |
|---|---|---|---|
| 13 | Oct 19 and 22 | Client interview and Creative Brief | Approved request letter, interview notes, Creative Brief |
| 14 | Oct 26 and 29 | Initial design | Sitemap, wireframes, mockups of the main pages |
| 15 | Nov 2 and 5 | Version 1 (front end and back end) | Working system demo |
| 16 | Nov 9 and 12 | Web testing and technology transfer | Accomplished testing instruments, user manual, signed Certificate of Utilization |
| 17 | Nov 16 and 19 | Presentation of final output | Live system demo and slides |
| 18 | Nov 23 and 26 | Submission of final report | Complete documentation (hard and soft copy) and the Peer Evaluation Sheet |

By the end of Week 18 the group must have: interviewed the client, built a system that meets the needs, tested it with real users at the client's site, turned it over and trained the users, secured a **Certificate of Utilization**, presented, and submitted the complete report.

> **Date conflict to resolve (D-05):** the Creative Brief timeline (development Nov 1–8, testing Nov 9–13) does not match the Guide (Version 1 demo in Week 15, Nov 2 or 5; testing and technology transfer in Week 16, Nov 9 or 12). The Guide wins. Plan to the Guide dates.

## 5. Week-by-week requirements

### Week 13 — Interview and Creative Brief

1. Get the **request letter** signed by the instructors, deliver it to the client, and keep the client-signed receiving copy **(D-01)**.
2. Prepare interview questions (maximum 7 main questions for our group).
3. Conduct the interview; take notes and, with permission, photos or a recording.
4. Prepare the **Creative Brief**, get instructor review, and retain the approved version.

The 7 interview questions (Filipino versions were kept in `Questionnaires.docx`, which is **not in this repository**):

1. What problems in your current way of handling requests, records and announcements do you hope a website or system can solve?
2. Who do you expect to use this system the most, and what should we know about them?
3. What would this system need to achieve for you to consider the project a success?
4. May we have a copy of the official logos, seals, color scheme, or photos we should follow?
5. Based on websites or online systems you've used before, what makes one easy and pleasant to use?
6. How do you picture the system working in your barangay, including what it should handle and what should stay manual?
7. What rules, conditions, or resources should we take into account when building and turning over the system?

Probe topics if answers leave gaps: online vs. offline, devices and connection, current step-by-step process and volume, sample forms and logbooks, admin vs. staff vs. resident roles, staff computer skills and maintainer, sensitive data, top three features, what the system must *not* do, content the barangay will provide and when, turnover dates and signers.

### Week 14 — Initial design

Present to the client and get feedback **before coding**; revise afterward. Must include:

1. **Sitemap** of all pages and how they connect.
2. **Wireframes** — simple black-and-white layouts of each main page (hand-drawn and scanned is acceptable).
3. **Mockups** — full-color designs of at least **[5]** main pages using the client's colors, logo and fonts (Figma, Canva, Adobe XD or similar).
4. **Style guide** — one page: color palette (hex), fonts and sizes, button styles, icons.
5. **Mobile view** — mockups of at least **[2]** pages on a phone screen.
6. **Client feedback** — the client's comments and the changes made.

Design principles: consistency across pages, clear navigation, readable text with enough contrast, visual hierarchy, simple forms with clear labels. Where each item stands is in [03-Design-and-UI.md](03-Design-and-UI.md).

### Week 15 — Version 1

Build the front end (pages, layout, styles) from the approved design and the back end (database, login, data processing). Demo in class: all main features must work, even if they need polish.

### Week 16 — Testing and technology transfer

1. Test with **Instrument A** (Test Case Form), fix errors and retest.
2. Install or deploy the system at the client's site with the network setup from Networking 2.
3. Let the client and real users try it, then answer **Instrument B** (User Evaluation Survey).
4. **Technology transfer:** turn over the system, train users, hand over the user manual (printed and soft copy) and login accounts.
5. Have the client sign the **Certificate of Utilization**.
6. Take photos of the testing, training and turnover.

### Week 17 — Presentation

About **[15] minutes** plus Q&A: the client and problem, design process, **live demo**, testing results, turnover. All members must be present and ready to answer.

### Week 18 — Final report

Hard copy and soft copy (section 9), together with the Peer Evaluation Sheet.

## 6. Creative Brief structure (2–3 pages, signed)

The final brief lives in [02-Requirements-and-Scope.md](02-Requirements-and-Scope.md). The Guide's required parts:

| # | Part | What to write |
|---|---|---|
| 1 | Project title | Name of the system |
| 2 | Client profile | Office name, address, contact person, what they do, who the users are |
| 3 | Background and problem | How they work now and the problems with it |
| 4 | Project objectives | 3 to 5 specific statements |
| 5 | Target users | Admin, staff, residents; age range; computer skills |
| 6 | Scope and limitations | Features included and what the system will **not** do |
| 7 | Main features | Modules and functions |
| 8 | Platform | Online or offline; devices; hosting or installation setup |
| 9 | Look and feel | Brand colors, logo, fonts, mood, sample sites |
| 10 | Content | Text, photos and data the client provides, and when |
| 11 | Timeline | Key dates from the schedule |
| 12 | Approval | Signatures of the client and the group leader, with date |

> The Guide's heading says the brief is **signed by the client**; the repository records only that the **professor** signed it, and the approval block in the brief still has blank client/leader signature lines **(D-02)**.

## 7. Testing instruments

- **Instrument A — Test Case Form** (filled in by the group). Columns: test no., feature/module, test steps, expected result, actual result, pass/fail, remarks. Starter cases: login (correct and wrong password), add record (valid and missing required field), search, edit, delete with confirmation, report generation and printing, responsiveness on a phone, logout (protected pages cannot be opened afterward). **Project additions required by our own safeguards:** authentication, authorization (including direct API calls), input validation, document issuance, export, backup and restore. Fix every failed test, retest, and record the result.
- **Instrument B — User Evaluation Survey** (client and real users, at least **[10]** respondents including the client; who takes part is **D-41**). Scale 5 Strongly Agree to 1 Strongly Disagree, 12 statements in five categories: Functionality, Usability, Design, Performance and Reliability, Security. Compute the mean per item and per category. The 12 statements themselves are not in the repository **(D-07)**.

| Mean | Interpretation |
|---|---|
| 4.21 – 5.00 | Strongly Agree / Excellent |
| 3.41 – 4.20 | Agree / Very Good |
| 2.61 – 3.40 | Neutral / Good |
| 1.81 – 2.60 | Disagree / Fair |
| 1.00 – 1.80 | Strongly Disagree / Poor |

Present results in a table in the final report and explain what they mean.

## 8. User manual and Certificate of Utilization

**User manual** — for someone who has never seen the system. **Every instruction needs a screenshot** with the button or field circled or pointed with an arrow, labeled (e.g. "Figure 3. Add Record form"). Number the steps, start each with an action word (Click, Type, Select, Open), use simple words. Contents: (1) cover page with system name, client, version, date, members · (2) introduction · (3) system requirements · (4) getting started: open the system and log in · (5) step-by-step instructions per feature · (6) user roles · (7) troubleshooting · (8) contact information. Give the client a **printed and a soft copy** at turnover. Screenshots must use fictional data. Daily-operation content (turn on the host, tell when the system is ready, open it from other computers, what to do if it does not load, who may restart it, safe shutdown) is outlined in [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md); Docker commands belong only in an administrator troubleshooting section.

**Certificate of Utilization** — the client's written proof that the system was received and is in use. Print on the client's letterhead if they have one and have it signed during turnover. It states: the system title; the three students' full names (leader first) of LSPU – Los Baños Campus; that the system was installed, tested and turned over on a given date and is used for a stated purpose; that it was developed for ITST301, Integrative Programming, Client-Server Technologies and Networking 2; the date and address; and the signature, name and position of the client's head **(D-42)**.

## 9. Final report (due Week 18)

Order of contents: (1) title page · (2) table of contents · (3) approved request letter · (4) signed Creative Brief · (5) initial design with client feedback · (6) system overview with screenshots · (7) testing instruments and results · (8) user manual · (9) signed Certificate of Utilization · (10) narrative report with photos · (11) appendices (interview notes, attendance sheets, other proofs).

**Narrative report:** one each for the **interview**, **web testing** and **technology transfer**, each 1–2 pages with at least **[4]** captioned photos covering when and where, who attended, what was discussed or done, and the results.

**Format:** [A4 / short bond], Arial or Times New Roman size 12, 1.5 spacing, 1-inch margins, page numbers. Submit a printed and bound copy plus a soft copy (PDF, the system's source code and database) via [Google Drive].

## 10. Grading (ITST301, suggested weights)

| Component | Weight |
|---|---|
| Creative Brief and initial design | [20%] |
| Web system (front end and UI/UX) | [30%] |
| Testing and technology transfer | [15%] |
| Final presentation | [15%] |
| Final report | [10%] |
| Peer evaluation | [10%] |

**Peer evaluation:** each group leader rates every member's participation and contribution **1 to 10** on the ITST301 Peer Evaluation Sheet, based on actual work, not friendship. Hard copy, submitted with the final report in Week 18. Ratings are confidential and members may receive different grades. Guide: 9–10 excellent · 7–8 good · 5–6 fair · 3–4 poor · 1–2 no contribution.

Bracketed values `[ ]` in sections 5, 9 and 10 are **unconfirmed** and need Prof. Camba's answer **(D-03)**.

## 11. Status (as of November 1, 2026)

The client prefers fully offline operation on the office LAN. The repository has an initial Docker Compose path and a deployment guide, but it has **not** been built from scratch, tested without internet, or verified at the client site. The Admin portal UI is a **frontend prototype with fictional data**; most workflows are not connected to the backend.

- [x] Group formed; client assigned
- [x] Questionnaire drafted and fixed (7 questions)
- [x] Client interviews conducted October 19–20, 2026
- [x] Final Creative Brief signed by the professor
- [x] Sample document formats, issuing workbook, logo, ID layout and resident/ID data sheets reported received
- [x] Initial Docker self-hosting configuration and offline LAN guide prepared (unverified at client site)
- [x] Authentication, authorization, lockout and security controls documented
- [x] Admin portal UI draft built (fictional data; not connected to backend)
- [x] Three template-generated Dependabot pull requests closed; dependency updates handled deliberately
- [ ] Week 14 deliverables: wireframes, full-color mockups, mobile mockups, one-page style guide and client feedback **(D-06)** — a site map, design draft and working style guide exist in the docs, but no evidence of wireframes/mockups or client review is recorded
- [ ] Offline/LAN setup tested without internet and approved by the client; host, backup, photo workflow and recovery responsibilities confirmed
- [ ] Pre-printed form layouts calibrated and sample print alignment approved by the client
- [ ] Version 1 (working demo)
- [ ] Testing and technology transfer
- [ ] Presentation
- [ ] Final report

## 12. Rules for AI assistants

When this file is pasted into a chat, the assistant should:

1. Treat the Final Project Guide and these documents as the source of truth. Do not invent requirements, deadlines, rubrics or client facts; say what is unknown and ask.
2. Guide the students; they must understand and be able to defend their own work. Explain choices and review code rather than only dumping solutions.
3. Connect advice to the milestone and the subject(s) it satisfies.
4. Prefer small, working, tested modules; flag scope creep and risks early.
5. Give practical advice for a three-person student team on free tiers.
6. Keep resident data and secrets out of code and chats.

## 13. Maintaining this documentation

- Update the relevant file in the same pull request that changes a decision.
- When an open decision is settled, move it from [08-Open-Decisions.md](08-Open-Decisions.md) into the file it affects, and tick it off.
- Long material (interview notes, mockups, test results, narrative reports) belongs in its own working file or the final report appendices.
- Record work in the individual journals ([Developers-Journal/README.md](Developers-Journal/README.md)) and issues in [Bug-and-Issue-Log.md](Bug-and-Issue-Log.md).
