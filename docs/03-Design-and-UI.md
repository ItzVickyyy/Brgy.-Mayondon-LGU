# 03 · Design and UI

Site map, navigation, page layouts, visual style and the state of the Admin portal prototype. Combines the former Site Map and Design Draft, Style Guide and Admin Portal Draft.

**Status:** design draft for group review and client validation — **not client-approved**. The prototype lives on `draft/admin-portal` and uses **fictional data**. A screen existing is not evidence that the feature works. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 1, 2026

## 1. Design basis

Based on the October 19–20 interviews and the final Creative Brief ([02-Requirements-and-Scope.md](02-Requirements-and-Scope.md)). The system is **staff-facing**. Do not add public resident accounts, public applications, announcements, online payments or blotter workflows without client confirmation. Never use real resident data in sample screens, commits, screenshots or demos.

## 2. Site map

```mermaid
flowchart TD
    A["System Entry"] --> B["Staff Login"]
    A --> C["Request Access (proposed, D-11)"]
    C --> D["Pending / Rejected Status Messages"]
    B --> E["Dashboard"]

    E --> F["Resident Records"]
    F --> F1["Resident List and Search"]
    F1 --> F2["Resident Profile"]
    F2 --> F3["Family / Beneficiary / Sector Details"]
    F1 --> F4["Import Masterlist"]

    E --> G["Document Management"]
    G --> G1["Document Requests"]
    G1 --> G2["New Request"]
    G2 --> G3["Review Resident Details"]
    G3 --> G4["Generate and Print"]
    G --> G5["Issuance History"]
    G5 --> G6["Issuance Details"]
    G6 --> G7["Correction with Reason"]

    E --> H["Barangay ID Management"]
    H --> H1["ID List and Search"]
    H1 --> H2["ID Details"]
    H2 --> H3["Create / Renew ID"]
    H3 --> H4["Generate and Print ID"]

    E --> I["My Account"]
    I --> I1["My Account"]
    I --> I2["User Settings"]

    E --> J["Admin-only Administration (proposed)"]
    J --> J1["Officials List"]
    J1 --> J2["Add / Edit / Archive Official"]
    J --> J3["User Accounts"]
    J3 --> J4["Create Staff Account"]
    J3 --> J5["Edit / Deactivate Staff"]
    J --> J6["Pending Registrations"]
    J6 --> J7["Approve / Reject Registration"]
    E --> J8["Activity Log (role-filtered)"]
    J --> J9["Management Reports"]
    J --> J10["Backup and Restore"]
```

This is the proposed information architecture, not a statement that every page exists. Some entries may be tabs or subviews instead of separate URLs. The Admin-only branch depends on the unresolved role model **(D-10)**.

## 3. Navigation

**Workspace:** Dashboard · Activity Log
**Records and Documents:** Resident Records · Issuance Management · Barangay IDs
**User menu:** My Account (account information, Change Password) · User Settings (appearance preferences)
**Administration — System Administrator only (proposed):** Officials · User Accounts · Pending Registrations · Management Reports · Backup and Restore

Staff see only their own activity; administrators see everyone's with filters. Administrator-only routes show a friendly restricted-access screen for Staff. **That is usability, not security:** the backend must enforce every protected operation ([05-Roles-Security-and-Privacy.md](05-Roles-Security-and-Privacy.md)).

## 4. Page layout draft

### Dashboard
- Page title and short description of the system's purpose.
- Summary cards: document issuances; clearances nearing expiry; Barangay IDs nearing expiry; a role-specific pending-queue card. Use real database values only once connected, and never present invented figures as barangay statistics. Keep the existing issuance-over-time and issuance-by-document-type charts.
- Quick links to Resident Records, Document Requests, Issuance History, Barangay IDs.
- Recent activity: own actions for Staff; system-wide for Admin if approved.
- *Superseded:* earlier population / household / registered-voter / demographics cards were removed because they are outside the brief. Do not reintroduce unsupported population/voter management unless the client confirms it **(D-21)**.

### Resident Records
Heading, search and clear primary actions; search by identifiers the client confirms; responsive table or mobile card list; resident profile (personal details, family/beneficiary/sector information, ID information, issuance history); import flow with file selection, preview, validation errors, duplicate detection and a summary of imported/updated/skipped/failed rows; **archive/inactive status instead of permanent deletion** **(D-19, D-20, D-26)**.

### Document Management
- Keep requests separate from issued-document history.
- Workflow: select the **resident first**, then document type and purpose, then show only the fields that document needs. Reuse saved resident details.
- Printing follows the pre-printed-paper overlay rule ([04-Documents-and-Printing.md](04-Documents-and-Printing.md)).
- Issuance history preserves the original; corrections need a reason and an audit entry, never silent overwrite or delete.

### Barangay ID Management
Searchable list; preserve existing numbering; show validity and registration status; support one-year validity and six-month validity for new/renting residents (final rule unconfirmed **(D-18)**); photo upload and print layout. Do not assume photo background removal works offline until a local solution is verified.

### Officials (proposed, admin-only)
Separate from login accounts. Proposed fields: full name, position, term start/end, active/inactive, optional photo. Prefer archive/inactive for former officials. Adding an official must never create a login account. Not in the brief **(D-23)**.

### User Accounts and Registration (proposed)
Admin creates active Staff accounts directly. Staff self-registration creates a *pending* account that only Admin can approve or reject; pending and rejected accounts must not reach protected pages or APIs. No public Admin registration; the first Admin is provisioned through controlled initial setup **(D-11)**.

### Activity Log (proposed)
Shared page. Staff see own activity; Admin searches and filters across users. Capture actor, action, module, record reference, timestamp, outcome and reason where required. Never log passwords, tokens or unnecessary resident data. Ordinary users cannot edit or delete audit history **(D-24)**.

### Reports, settings, backup
Reports: issuances by date/type/purpose, expiring records, imports, corrections, account activity — confirm needs with the client **(D-21)**. User preferences stay in User Settings; **where the purpose list is maintained is undecided** since System Settings was removed **(D-22)**. Backup and Restore is Admin-only with clear confirmation before destructive restore and a recorded outcome **(D-35)**.

## 5. Visual direction and style guide

**Direction:** formal, calm, clean, office-focused. Keep the navy-leaning primary, white/light-gray surfaces, clear headings, consistent borders, responsive cards and tables. Persistent sidebar on desktop, collapsible on small screens, visible focus states, tables usable on phones (how far to go on mobile is **D-29**).

**Current theme palette** (OKLCH tokens in the global stylesheet; hex values are rounded sRGB equivalents; the source CSS is authoritative):

| Token | Light | Dark | Use |
|---|---|---|---|
| Background | `#FFFFFF` | `#0A0A0A` | Page surface |
| Foreground | `#0A0A0A` | `#FAFAFA` | Main text |
| Card | `#FFFFFF` | `#343434` | Cards and panels |
| Primary | `#0C2F52` | `#1D3F63` | Primary actions, key accents |
| Primary foreground | `#FAFAFA` | `#FAFAFA` | Text/icons on primary |
| Secondary / muted | `#F5F5F5` | `#262626` | Quiet surfaces |
| Muted foreground | `#737373` | `#A1A1A1` | Supporting text |
| Border / input | `#E5E5E5` | alpha-white | Separators, form controls |
| Destructive | `#E7000B` | `#FF6467` | Destructive actions, errors |
| Focus ring | `#A1A1A1` | `#737373` | Keyboard focus |
| Sidebar | `#FAFAFA` | `#343434` | Navigation surface |

Base radius `0.625rem`. These describe the **current implementation, not client-approved brand specs**.

**Typography and spacing**
- The stylesheet defines no custom font; the brief suggests Arial. Pick one and apply it consistently **(D-28)**.
- Headings: `text-2xl font-bold tracking-tight sm:text-3xl`. Body at least 16px for form/table content where practical.
- Use the Tailwind spacing scale and recurring card padding (`p-4`, `sm:p-5`). Icons `size-4` / `size-5` / `size-6`.
- Preserve responsive grids: single-column on narrow screens, expanding at existing breakpoints.

**Components and interaction**
- Use existing shadcn/ui components; visible labels on inputs and accessible names on icon-only controls.
- 44px minimum height for primary touch controls and inputs; visible keyboard focus.
- Confirm before archive, void/cancel, reject or restore.
- Show status as text, not color alone.
- Wrap wide tables in horizontal scroll or use a mobile card layout.
- No sample-data badges or prototype banners in the UI (team decision, Nov 1, 2026); keep all demo data fictional.
- Verify WCAG AA contrast on actual rendered text before calling the design accessibility-checked. Token names are not proof.
- Do not change global tokens unless there is a real contrast or consistency issue, reviewed across light and dark themes.

**Assets:** logo path in app config `/assets/images/Barangay%20Mayondon%20Logo.png`. Confirm exact brand colors, typography, print styling, status colors and logo clear-space with the client **(D-28)**.

**Printing:** screen styling is not print styling. Build and test separate print layouts against the real forms.

## 6. Admin portal prototype — what exists

Branch `draft/admin-portal` contains frontend pages for Dashboard, Records Management, Issuance Management, Barangay IDs (`/barangay-ids`), Officials, User Management, Activity Log (`/activity-log`), Pending Registrations (`/pending-registrations`), Reports (`/reports`) and Backup and Restore (`/backup-restore`), plus Request Access and Pending Approval screens. The former separate My Activity route and the unused Items route were removed.

**Everything below is prototype-only:**

- Dashboard figures, charts, history rows, names and activity are **fictional**; charts are not connected to live statistics.
- Records and Officials show sample rows and do not create, update or delete database records.
- Issuance drafts live in browser memory for the page session only; refreshing clears them. They are not official issuances and are not connected to a database or API.
- The Document Management resident selector uses hard-coded sample residents; purposes are hard-coded.
- **Printing is intentionally paused.** The generic print action no longer opens the browser print dialog because it would print labels/logos that conflict with the pre-printed workflow.
- Masterlist import shows a file-selection area and planned validation summary; parsing, mapping, preview, duplicate detection and import are not implemented.
- Request Access / Pending Approval / Pending Registrations do not submit, save, approve, reject or create accounts. Sidebar pending counts are fictional.
- The account form maps **System Administrator → `is_superuser = true`** and **Staff → `is_superuser = false`**. No separate backend role enum exists, and `is_active` cannot represent pending/rejected.
- Backup/Restore screen is a concept (manual backup, proposed schedule controls, sample history, restore confirmation layout). It does not run any backup or restore.
- Account profile, password change and account management use the existing foundation functionality.
- The footer shows branding only; Terms of Use and Privacy Policy are not implemented. Any legal text must be marked "Draft, pending barangay review".
- A public `/welcome` landing page with placeholder announcements and contact details exists from earlier work. Public content is **out of scope**; remove or make staff-oriented **(D-27)**. Do not publish placeholder contact details as facts.

## 7. Creative Brief alignment (updated)

| Brief requirement | Prototype status | Remaining work |
|---|---|---|
| Dashboard: issued documents and expiring clearances/IDs | Layout retained; cards use fictional values | Connect verified database totals |
| Resident records: add, edit, search | List/profile draft with sample rows | Create/edit/profile actions and persistence; confirm search fields |
| Family, beneficiary, sector details | Draft tab | Confirm real fields and sector categories against the masterlists |
| Import masterlists | Draft file area and validation summary | Parsing, mapping, preview, validation, duplicates, import |
| Resident and Barangay ID records | `/barangay-ids` with search, status filter, issue/expiry dates, Create/Details/Renew/Print placeholders | Connect to residents; numbering; expiry calculation; photo handling; physical print layout |
| Document request entry and editable purposes | Resident-first selector; purposes hard-coded | Connect to saved residents; maintainable purposes; persist requests |
| Separate issuance history with issue/expiry | Session-only history, no expiry shown | Persistent records, expiry where applicable, details, corrections preserving the original |
| Auto-filled printing on existing formats | Printing paused | Per-document overlay templates calibrated on real paper/printer |
| Scheduled and manual backup/restore | Concept screen exists; no automation | Wire to approved scripts; define schedule/destination; test restore |
| Fully offline LAN use | Deployment foundation exists | Test host startup, other-PC access, printers, firewall, recovery offline |
| Public features excluded | Welcome page still has placeholder content | Remove public/announcement direction (D-27) |

## 8. Week 14 checklist

- [ ] Review the site map as a group.
- [ ] Validate workflows and exclusions against the brief and interview notes.
- [ ] Present the draft to the client and record feedback before treating it as approved.
- [ ] Prepare wireframes for the main workflows.
- [ ] Prepare full-color mockups for at least the suggested **[5]** main pages.
- [ ] Prepare a one-page style guide and mobile mockups for at least **[2]** pages (section 5 is the working basis).
- [ ] Confirm the bracketed quantities with Prof. Camba **(D-03)**.
- [ ] Revise from client feedback before coding against the designs.

## 9. Before merging `draft/admin-portal` work

1. Confirm scope and document workflows with the client.
2. Confirm dashboard metrics, reporting periods and historical data availability.
3. Confirm whether drafts need persistence, official numbering, editing, cancellation or deletion.
4. Review form fields and print layouts with the barangay.
5. Review mobile and desktop layouts with the client.
6. Run `cd frontend && bun run lint && bun run build` and the Playwright suite; review route, navigation and role-related failures.
7. Manually check dashboard, sidebar, login, request-access, pending-approval, pending-registrations and user-account flows at **375px, 768px and 1280px**.
8. Test Staff and System Administrator views separately, including direct navigation to restricted routes.
9. Confirm role and authorization behavior **in the backend**, and audit logging, before any real data.
10. Replace fictional data only after an approved data plan exists. Do not claim client approval based on the prototype.
