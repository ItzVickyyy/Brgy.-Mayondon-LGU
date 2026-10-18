# Source of Truth

The single reference for the Barangay Mayondon LGU Final Project: requirements,
schedule, decisions and status. If something conflicts with another file or
chat, **this file wins**. If this file conflicts with the instructor's *Final
Project Guide*, the Guide wins; fix this file.

**How to use it with a free AI assistant:** paste this whole file at the start of
a new chat, then ask your question. Update the file whenever a decision changes
(see [Maintenance](#maintenance)).

Last updated: October 18, 2026

---

## 1. Project at a glance

| | |
|---|---|
| Project | A working web system for a real client, designed, built, tested and turned over by one group |
| Client | Barangay Mayondon LGU, Los Baños, Laguna (assigned by Prof. Camba) |
| System to build | **Not decided yet.** Decided after the client interview (Week 13) |
| Hosting | Online: **Vercel** (frontend and API) + **Supabase** (PostgreSQL). See `Complete-Tech-Stacks.md` |
| School | Laguna State Polytechnic University – Los Baños Campus |
| Program | BSIT, Major in Web and Mobile Application Development (WMAD), Section 3A |
| Merged courses | One project replaces the separate final projects of four subjects |

**Project rules**
- Build 3–4 modules that fully work rather than many half-finished ones.
- Never invent client facts or requirements; ask the client.
- Residents' personal data is sensitive (Data Privacy Act of 2012): least-privilege
  access, no real data or secrets in git, no real data in class demos.

---

## 2. Team

| Member | Role |
|---|---|
| Vic John O. Salen Jr. | Project Leader, Lead Developer (also fills out the Peer Evaluation Sheet) |
| Justin Adrian P. Reboton | Backend Developer, Technical Writer |
| Jean Mervin G. Fajardo | Frontend Developer |

Suggested ownership: **Vic** architecture, auth/roles, deployment, integration,
final demo · **Justin** models, migrations, API, tests, Creative Brief, user
manual, final report · **Jean** sitemap, wireframes, mockups, pages and
components, responsiveness, mobile view.

---

## 3. Subjects and what each one assesses

| Course | Instructor | Focus of assessment |
|---|---|---|
| ITST301 Principles of Web Design | Merardo Arenas Camba, Jr. | Client requirements, Creative Brief, UI/UX, layout, responsiveness, usability |
| Integrative Programming | Mike Philip Ramos | Back-end logic, database, integration of system modules |
| Client-Server Technologies | Alejandro V. Matute Jr. | Client-server setup, deployment, data exchange |
| Networking 2 | Mike Philip Ramos | Network setup, connectivity and security at the client's site |

The *Final Project Guide* is written by Prof. Camba (ITST301) and gives the
ITST301 grading. The other three subjects may have their own requirements:
confirm them with Sir Matute and Sir Ramos.

---

## 4. Schedule (2026)

Each milestone is checked in class. A group that falls behind should book a
consultation immediately (Google Calendar, merardo.camba@lspu.edu.ph).

| Week | Dates | Milestone | Submit or show |
|---|---|---|---|
| 13 | Oct 19 and 22 | Client interview and Creative Brief | Approved request letter, interview notes, Creative Brief |
| 14 | Oct 26 and 29 | Initial design | Sitemap, wireframes, mockups of the main pages |
| 15 | Nov 2 and 5 | Version 1 (front end and back end) | Working system demo |
| 16 | Nov 9 and 12 | Web testing and technology transfer | Accomplished testing instruments, user manual, signed Certificate of Utilization |
| 17 | Nov 16 and 19 | Presentation of final output | Live system demo and slides |
| 18 | Nov 23 and 26 | Submission of final report | Complete documentation (hard copy and soft copy) and the Peer Evaluation Sheet |

By the end of Week 18 the group must have: interviewed the client, built a
system that meets the needs, tested it with real users at the client's site,
turned it over and trained the users, secured a **Certificate of Utilization**,
presented, and submitted the complete report.

---

## 5. Week-by-week requirements

### Week 13: Interview and Creative Brief
1. Get the **request letter** signed by the instructors, deliver it to the client,
   and keep the client-signed receiving copy (the *approved request letter*).
2. Prepare interview questions (maximum 7 main questions for our group).
3. Conduct the interview; take notes and, with permission, photos or a recording.
4. Write the **Creative Brief** (template in section 6) and have the client sign it
   **before** designing.

Our 7 interview questions (each also has a Filipino version in `Questionnaires.docx`):
1. What problems in your current way of handling requests, records and announcements do you hope a website or system can solve?
2. Who do you expect to use this system the most, and what should we know about them?
3. What would this system need to achieve for you to consider the project a success?
4. May we have a copy of the official logos, seals, color scheme, or photos we should follow?
5. Based on websites or online systems you've used before, what makes one easy and pleasant to use?
6. How do you picture the system working in your barangay, including what it should handle and what should stay manual?
7. What rules, conditions, or resources should we take into account when building and turning over the system?

Topics to probe if the answers leave gaps: online vs. offline, devices and internet
connection, current step-by-step process and volume, sample forms and logbooks,
admin vs. staff vs. resident roles, staff computer skills and who maintains the
system, private/sensitive data, top three features, what the system must *not*
do, content the barangay will provide and when, turnover dates and who signs.

### Week 14: Initial design
Present to the client and get feedback **before coding**; revise afterward. Must include:
1. **Sitemap**: all pages and how they connect.
2. **Wireframes**: simple black-and-white layouts of each main page (hand-drawn and scanned is acceptable).
3. **Mockups**: full-color designs of at least **[5] main pages** using the client's colors, logo and fonts (Figma, Canva, Adobe XD or similar).
4. **Style guide**: one page with color palette (hex codes), fonts and sizes, button styles, icons.
5. **Mobile view**: mockups of at least **[2] pages** on a phone screen.
6. **Client feedback**: the client's comments and the changes made.

Design principles: consistency across pages, clear navigation, readable text with
enough contrast, visual hierarchy, simple forms with clear labels.

### Week 15: Version 1
Build the front end (pages, layout, styles) from the approved design and the back
end (database, login, data processing). Demo in class: all main features must
work, even if they need polish.

### Week 16: Testing and technology transfer
1. Test with **Instrument A** (Test Case Form), fix errors and retest.
2. Install or deploy the system at the client's site with the network setup from Networking 2.
3. Let the client and real users try it, then answer **Instrument B** (User Evaluation Survey).
4. **Technology transfer**: turn over the system, train users, hand over the user manual (printed and soft copy) and login accounts.
5. Have the client sign the **Certificate of Utilization**.
6. Take photos of the testing, training and turnover.

### Week 17: Presentation
About **[15] minutes** plus Q&A: the client and problem, design process, **live
demo**, testing results, turnover. All members must be present and ready to answer.

### Week 18: Final report
Hard copy and soft copy (section 10), together with the Peer Evaluation Sheet.

---

## 6. Creative Brief (2–3 pages, signed by the client)

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
| 9 | Look and feel | Brand colors, logo, fonts, mood, sample sites the client likes |
| 10 | Content | Text, photos and data the client provides, and when |
| 11 | Timeline | Key dates from the schedule |
| 12 | Approval | Signatures of the client and the group leader, with date |

---

## 7. Testing instruments

- **Instrument A: Test Case Form** (filled in by the group). Columns: test no., feature/module, test steps, expected result, actual result, pass/fail, remarks. Starter cases: login (correct and wrong password), add record (valid and missing required field), search, edit, delete with confirmation, report generation and printing, responsiveness on a phone, logout (protected pages cannot be opened afterward). Fix every failed test, retest and record the result.
- **Instrument B: User Evaluation Survey** (client and real users, at least **[10] respondents** including the client). Scale 5 Strongly Agree to 1 Strongly Disagree, 12 statements in five categories: Functionality, Usability, Design, Performance and Reliability, Security. Compute the mean per item and per category.

| Mean | Interpretation |
|---|---|
| 4.21 – 5.00 | Strongly Agree / Excellent |
| 3.41 – 4.20 | Agree / Very Good |
| 2.61 – 3.40 | Neutral / Good |
| 1.81 – 2.60 | Disagree / Fair |
| 1.00 – 1.80 | Strongly Disagree / Poor |

Present the results in a table in the final report and explain what they mean.

---

## 8. User manual

For someone who has never seen the system. **Every instruction needs a screenshot**
with the button or field circled or pointed with an arrow, labeled (e.g. "Figure 3.
Add Record form"). Number the steps, start each with an action word (Click, Type,
Select, Open), use simple words.

Contents: (1) cover page with system name, client, version, date, members ·
(2) introduction · (3) system requirements · (4) getting started: how to open the
system and log in · (5) step-by-step instructions per feature · (6) user roles,
admin vs. regular users · (7) troubleshooting · (8) contact information.
Give the client a **printed copy and a soft copy** at turnover.

---

## 9. Certificate of Utilization

The client's written proof that the system was received and is in use. Print it
on the client's letterhead if they have one and have it signed during turnover.
It states: the system title; the three students' full names (leader first) of LSPU
– Los Baños Campus; that the system was installed, tested and turned over to the
office on a given date and is used for a stated purpose; that it was developed for
ITST301 Principles of Web Design, Integrative Programming, Client-Server
Technologies and Networking 2; the date and address; and the signature, name and
position of the client's head.

---

## 10. Final report (due Week 18)

Order of contents: (1) title page · (2) table of contents · (3) approved request
letter · (4) signed Creative Brief · (5) initial design with client feedback ·
(6) system overview with screenshots · (7) testing instruments and results ·
(8) user manual · (9) signed Certificate of Utilization · (10) narrative report
with photos · (11) appendices (interview notes, attendance sheets, other proofs).

**Narrative report:** one narrative each for the **interview**, **web testing** and
**technology transfer**, each 1 to 2 pages with at least **[4] photos** with
captions. Cover when and where, who attended, what was discussed or done, and the
results.

**Format:** [A4 / short bond paper], Arial or Times New Roman size 12, 1.5 spacing,
1-inch margins, page numbers. Submit a printed and bound copy plus a soft copy
(PDF, the system's source code and database) via [Google Drive].

---

## 11. Grading (ITST301, suggested weights)

| Component | Weight |
|---|---|
| Creative Brief and initial design | [20%] |
| Web system (front end and UI/UX) | [30%] |
| Testing and technology transfer | [15%] |
| Final presentation | [15%] |
| Final report | [10%] |
| Peer evaluation | [10%] |

**Peer evaluation:** each group leader rates every member's participation and
contribution from **1 to 10** using the ITST301 Peer Evaluation Sheet, based on
actual work, not friendship. Hard copy, submitted with the final report in Week 18.
Ratings are confidential and members may receive different grades. Rating guide:
9–10 excellent · 7–8 good · 5–6 fair · 3–4 poor · 1–2 no contribution.

---

## 12. Decisions made

| Decision | Detail |
|---|---|
| Starting point | Full Stack FastAPI Template, cloned and tailored for this project |
| Backend | FastAPI + SQLModel + PostgreSQL, Python 3.14 |
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Deployment | **Vercel** (frontend and API in two projects) + **Supabase** (database); deployment remains untested |
| Accounts | Admin-only account creation; open sign-up is disabled. `is_superuser` = Admin, other users = Staff |
| Branding | Centralized in `frontend/src/config/site.ts`; official logo pending |
| AI tools | Free-tier AI assistants only; this folder is the shared context |

---

## 13. Open items

- [ ] Request letter signed by all three instructors (Oct 19), then delivered to the barangay; fill in the client's name, position, office and address
- [ ] Interview done; sample forms, logbooks, logo and seal collected
- [ ] **Which modules** the system will have (decide from the client's answers)
- [ ] Confirm bracketed values in the Guide with Prof. Camba: number of mockup pages, mobile pages, presentation length, survey respondents, photos per narrative, paper size, submission platform
- [ ] Confirm with Sir Ramos what **Networking 2** expects when the system is cloud-hosted (e.g. network setup, connectivity and security checks at the barangay hall) and what Sir Matute expects for **Client-Server Technologies**
- [ ] Confirm the barangay has reliable internet and devices for an online system; if not, discuss an offline option
- [ ] Set up the Vercel and Supabase accounts and agree who owns them
- [ ] Deploy preview projects and verify routing, CORS, database connections, migrations, and login before production use

---

## 14. Status

- [x] Group formed; client assigned
- [x] Questionnaire drafted and fixed (7 questions)
- [x] Request letter drafted (to be signed Oct 19)
- [x] Repository tailored from the template (branding, closed registration)
- [x] Foundation deployment configuration prepared (Vercel entrypoint, SPA fallback, configurable Vite output, explicit CORS origins, Supabase transaction-pooler support); hosting not yet verified
- [x] Closed the three template-generated Dependabot pull requests that targeted `master`; dependency updates will be handled deliberately
- [ ] Interview
- [ ] Creative Brief
- [ ] Design
- [ ] Version 1
- [ ] Testing and turnover
- [ ] Presentation
- [ ] Final report

---

## 15. Rules for AI assistants

When this file is pasted into a chat, the assistant should:
1. Treat this file and the Final Project Guide as the source of truth. Do not invent requirements, deadlines, rubrics or client facts; say what is unknown and ask.
2. Guide the students; they must understand and be able to defend their own work. Explain choices and review code rather than only dumping solutions.
3. Always connect advice to the milestone and to the subject(s) it satisfies.
4. Prefer small, working, tested modules; flag scope creep and risks early.
5. Give practical advice for a three-person student team on free tiers.
6. Keep resident data and secrets out of code and chats.

---

## Maintenance

- Update this file in the same pull request that changes a decision.
- Move items from **Open items** to **Decisions made** as they are settled, and tick the **Status** list.
- Anything that grows long (interview notes, mockups, test results) goes into its own file or the final report appendices; link it here.
