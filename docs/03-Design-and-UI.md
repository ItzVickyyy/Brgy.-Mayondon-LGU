# 03 · Design and UI

Site map, navigation, page layouts, visual style and the state of the Admin portal prototype. Combines the former Site Map and Design Draft, Style Guide and Admin Portal Draft.

**Status:** design draft for group review and client validation — **not client-approved**. The prototype lives on `draft/admin-portal` and uses **fictional data**. A screen existing is not evidence that the feature works. Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 7, 2026

## 1. Design basis

Based on the October 19–20 interviews and the final Creative Brief ([02-Requirements-and-Scope.md](02-Requirements-and-Scope.md)). The system is **staff-facing**. Do not add public resident accounts, public applications, announcements, online payments or blotter workflows without client confirmation. Never use real resident data in sample screens, commits, screenshots or demos.

## 2. Site map

```mermaid
flowchart TD
    A["System Entry"] --> B["Staff Login"]
    B --> E["Dashboard"]

    E --> F["Records Management"]
    F --> F1["Residents tab: list and search"]
    F1 --> F2["Resident Profile"]
    F --> F5["Barangay IDs tab: ID list, status, Print / Renew"]
    F --> F3["Family and Sector Details tab"]
    F --> F4["Import Masterlist tab (admin only)"]
    F5 -.->|"opens New Issuance, ID type"| G

    E --> G["Document Management"]
    G --> G1["Document Requests"]
    G1 --> G2["New Request"]
    G2 --> G3["Review Resident Details"]
    G3 --> G4["Generate and Print"]
    G --> G5["Issuance History"]
    G5 --> G6["Issuance Details"]
    G6 --> G7["Correction with Reason"]

    E --> I["My Account"]
    I --> I1["My Account"]
    I --> I2["User Settings"]

    E --> J["Admin-only Administration (proposed)"]
    J --> J1["Officials List"]
    J1 --> J2["Add / Edit / Archive Official"]
    J --> J3["User Accounts"]
    J3 --> J4["Create Staff Account"]
    J3 --> J5["Edit / Deactivate Staff"]
    E --> I3["Change your password (forced after a temporary password)"]
    E --> J8["Activity Log (role-filtered)"]
    J --> J9["Management Reports"]
    J --> J10["Backup and Restore"]
```

This is the proposed information architecture, not a statement that every page exists. Some entries may be tabs or subviews instead of separate URLs. The Admin-only branch depends on the unresolved role model **(D-10)**.

## 3. Navigation

**Workspace:** Dashboard · Activity Log
**Records and Documents:** Records Management · Issuance Management
**User menu:** My Account (account information, Change Password) · User Settings (appearance preferences)
**Administration — System Administrator only (proposed):** Officials · User Accounts · Management Reports · Backup and Restore

Staff see only their own activity; administrators see everyone's with filters. Administrator-only routes show a friendly restricted-access screen for Staff. **That is usability, not security:** the backend must enforce every protected operation ([05-Roles-Security-and-Privacy.md](05-Roles-Security-and-Privacy.md)).

## 4. Page layout draft

### Dashboard
- Page title and short description of the system's purpose.
- Summary Statistics: documents issued this month; clearances expiring in 30 days; Barangay IDs expiring in 30 days; a Pending Document Requests card (drafts not yet issued) for both roles. Values read 0 until real data exists. Use real database values only once connected, and never present invented figures as barangay statistics. Keep the existing issuance-over-time and issuance-by-document-type charts.
- **Quick Actions** sit directly under Summary Statistics (horizontal row on wide screens, stacked on small ones; no subtitle, short cards): Find a resident (`/records`), Create an issuance (`/issuances`), Review issuance history (`/issuances`), View dashboard activity (`/activity-log`). Cards use the theme colour only, with a stronger tint, border and icon chip; **do not add per-card colours** (see [10-Decisions-Already-Made.md](10-Decisions-Already-Made.md)).
- Recent activity: own actions for Staff; system-wide for Admin if approved.
- *Superseded:* earlier population / household / registered-voter / demographics cards were removed because they are outside the brief. Do not reintroduce unsupported population/voter management unless the client confirms it **(D-21)**.

### Records Management
One page at `/records` (heading "Records Management") with four tabs: **Residents**, **Barangay IDs**, **Family & Sector Details** and **Import Masterlist** (admin only). `?view=barangay-ids` opens the ID tab. The old `/barangay-ids` route only redirects to `/records?view=barangay-ids`; it is not a page.

- **Residents:** heading, search and clear primary actions; search by identifiers the client confirms (an ID number still matches); responsive table or mobile card list; the table shows an **ID status badge only**, not the ID number. A "Residents with Valid ID" stat card sits above it. Resident profile (personal details, family/beneficiary/sector information, ID information, issuance history). **Archive/inactive status instead of permanent deletion** **(D-19, D-20, D-26)**.
- **Barangay IDs** (`components/Records/BarangayIdsView.tsx`): searchable list of each resident's latest issued ID (search by name, ID number or reference; status filter; server paging) with four counts at the top. Administrators also see an **ID number series** card above the counts ("Set up" or "Edit"): prefix, next number, digits, put the year in the number, start again at 1 each year, and a switch for automatic numbering, with a live example. It starts **off**. While it is on, a new card gets the next number automatically; staff cannot type a number (the field is read-only and says so), a resident who already has a number keeps it, renewals and replacements keep it, and an administrator may still type a different number, which is recorded in the Activity Log. There is **no "Create Barangay ID" button**: IDs are issued in Issuance Management. A row's **Renew** (expiring or expired cards) and **Replace card** (lost or damaged) open `/issuances?resident=<residentId>&type=BARANGAY_ID`; New Issuance preselects the resident and type, and the page removes those two query values when the dialog closes. Rows of archived residents have no action. There is no Print button here because there is no ID card layout file yet **(D-44, D-45)**. Validity rules: one year, six months for new/renting residents (final rule unconfirmed **(D-18)**). Do not assume photo background removal works offline until a local solution is verified.
- **Import Masterlist (admin only, connected to `/api/v1/imports`):** four steps. 1) choose a CSV or XLSX file (up to 10 MB and 30,000 rows); 2) map columns to resident fields (suggested from the header names or the last mapping used; first and last name are required), pick how dates are written and whether duplicates are skipped or update the existing record; 3) preview with new / duplicate / problem counts, a row filter, a paged row list and a problem report (CSV, row numbers and reasons only); 4) confirm to import in one transaction, then see created / updated / skipped / failed. A short history of recent imports sits below. Staged rows are deleted on import, cancel or after 24 hours. Row problem messages come from the server in English; the known ones (street not in the list, unrecognised date, repeated or taken ID number, too long, not an allowed value, out-of-range numbers, required) are shown in the chosen language by `src/lib/importProblems.ts`, other text is shown as sent, and the downloaded problem report stays English.
- The former "ID Validity and Registration" notes box was removed. Do not bring it back.

### Document Management
- Keep requests separate from issued-document history.
- Workflow: select the **resident first**, then document type and purpose, then show only the fields that document needs. Reuse saved resident details.
- Printing follows the pre-printed-paper overlay rule ([04-Documents-and-Printing.md](04-Documents-and-Printing.md)).
- Issuance history preserves the original; corrections need a reason and an audit entry, never silent overwrite or delete.

### Officials (proposed, admin-only)
Separate from login accounts. Proposed fields: full name, position, term start/end, active/inactive, optional photo. Prefer archive/inactive for former officials. Adding an official must never create a login account. Not in the brief **(D-23)**.

### User Accounts and Registration (proposed)
Only the System Administrator creates accounts (active Staff accounts directly). There is no self-registration, no Request Access page and no pending or rejected account state **(D-11, decided Nov 7, 2026)**. The first Admin is provisioned through controlled initial setup. An account an administrator creates has no typed password: it starts with the default password `ChangeThisPassword` (a fixed value, the same in `backend/app/core/security.py` and `frontend/src/config/site.ts`), and Edit User can reset another account to it with a checkbox; an administrator cannot type a password for another person, and the default cannot be chosen as a real password. The account is a temporary-password account: the form says the default must be given to the user in person, the User Accounts table shows a "Temporary password" badge, and the user is sent to the `/change-password` screen at next sign-in. That screen sits outside the sidebar layout and blocks every other page until the password is changed; the user is then signed out and signs in again **(D-12, shipped Nov 7, 2026)**.

### Notification bell (patch 75)
A bell button sits in the top bar before the theme button. It opens a small menu (like the Profile menu) with the newest notices, an unread count on the button and "mark all as read" at the top; each unread notice has its own "mark as read" check. The list comes from the server (the audit log, filtered by role, shared by every computer), refreshes about every 45 seconds while the page is visible and when the menu opens, and the sentences follow the language in use. There is no "Clear all". Test ids: `notification-bell`, `notification-badge`, `notification-item` (`data-read`).

### Activity Log (proposed)
Shared page. Staff see own activity; Admin searches and filters across users. Capture actor, action, module, record reference, timestamp, outcome and reason where required. Never log passwords, tokens or unnecessary resident data. Ordinary users cannot edit or delete audit history **(D-24)**.

### Reports, settings, backup
Reports: the top of the page always shows three summary cards (Documents Issued, Records Expiring, Masterlist Imports) that read 0 until report data exists; there is no "No report data yet" message there. Planned content: issuances by date/type/purpose, expiring records, imports, corrections, account activity — confirm needs with the client **(D-21)**. User preferences stay in User Settings; **where the purpose list is maintained is undecided** since System Settings was removed **(D-22)**. Backup and Restore is Admin-only with clear confirmation before destructive restore and a recorded outcome **(D-35)**.

## 5. Visual direction and style guide

**Direction:** formal, calm, clean, office-focused. Keep the navy-leaning primary, white/light-gray surfaces, clear headings, consistent borders, responsive cards and tables. Persistent sidebar on desktop, collapsible on small screens, visible focus states, tables usable on phones (**decided Nov 1, 2026, D-29:** responsive, desktop-first; phone view is not a priority, and only the phone mockups the Guide requires are produced, count per D-03).

**Current theme palette** (OKLCH tokens in the global stylesheet; hex values are rounded sRGB equivalents; the source CSS is authoritative):

| Token | Light | Dark | Use |
|---|---|---|---|
| Background | `#FFFFFF` | `#0A0A0A` | Page surface |
| Foreground | `#0A0A0A` | `#FAFAFA` | Main text |
| Card | `#FFFFFF` | `#343434` | Cards and panels |
| Primary | `#0C2F52` | `#1D4F82` | Solid fills with white text: buttons, selected chips |
| Brand | `#0C2F52` | `#79B5F8` | Blue **text, icons, tints, borders, rings** (`text-brand`, `bg-brand/10`, `border-brand`, `ring-brand`) |
| Primary foreground | `#FAFAFA` | `#FAFAFA` | Text/icons on primary |
| Secondary / muted | `#F5F5F5` | `#262626` | Quiet surfaces |
| Muted foreground | `#737373` | `#A1A1A1` | Supporting text |
| Border / input | `#E5E5E5` | alpha-white | Separators, form controls |
| Destructive | `#E7000B` | `#FF6467` | Destructive actions, errors |
| Focus ring | `#A1A1A1` | `#737373` | Keyboard focus |
| Sidebar | `#FAFAFA` | `#343434` | Navigation surface |

Base radius `0.625rem`. The sidebar primary stays at its earlier values. These describe the **current implementation, not client-approved brand specs**.

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
- Do not change global tokens unless there is a real contrast or consistency issue, reviewed across light and dark themes. **This was done once (Nov 2026):** in dark mode the old primary (`oklch(0.36 0.075 252)`) had nearly the same lightness as the background, so blue text, icons, tints and bars disappeared (about 1.65:1 on a card). A `--brand` token was added (`--color-brand` in Tailwind). Light-mode brand equals the old primary; dark-mode brand is `oklch(0.76 0.115 252)` (about 8.4:1 on a card). Dark `--primary` was raised to `oklch(0.42 0.1 252)`. Amber and emerald status text got lighter `dark:` shades.
- **Colour rule:** use `text-brand` / `bg-brand/N` / `border-brand` for blue text, icons and tints. Use `bg-primary text-primary-foreground` only for solid fills with white text. Do not use `text-primary` for text.
- The dark/light palette is still not client-approved **(D-47)**, and the result has not been checked in a real browser in both modes.

**Assets:** logo path in app config `/assets/images/Barangay%20Mayondon%20Logo.png`. Confirm exact brand colors, typography, print styling, status colors and logo clear-space with the client **(D-28)**.

**Printing:** screen styling is not print styling. Build and test separate print layouts against the real forms.

## 6. Admin portal prototype — what exists

Branch `draft/admin-portal` contains frontend pages for Dashboard, Records Management, Issuance Management, Officials, User Management, Activity Log (`/activity-log`), Reports (`/reports`) and Backup and Restore (`/backup-restore`). Records Management (`/records`) holds both resident and Barangay ID records; `/barangay-ids` only redirects to it. The former separate My Activity route and the unused Items route were removed.

**Everything below is prototype-only:**

- **The Dashboard is connected** to `GET /api/v1/dashboard` and `GET /api/v1/activity?limit=5` (real counts, charts, expiring list and recent activity; see docs/09). **Reports (`/reports`) is connected** to `GET /api/v1/reports/*` for document type, purpose, expiring records and account activity. Expiring records are a snapshot as of today (the period does not apply), the Sign-ins column was removed (sign-ins are not recorded), and the masterlist import report lists the latest 100 imports (date, file, who, status, created / updated / skipped / failed; the period does not apply) and its CSV is English like the others. The "Masterlist Imports" card counts imports finished in the chosen period (`imports_committed` in `GET /api/v1/reports/summary`). CSV export is built in the browser from the loaded rows. **The Activity Log (`/activity-log`) is connected** to `GET /api/v1/activity` and `/activity/options` (filters, paging and the user list come from the server; Staff only ever receive their own rows). Friendly action titles are shared with the Dashboard in `src/lib/activity.ts`. The Module filter lists the modules the API reports, shown as Resident Records, Issuances, User Accounts, Officials and Streets and Associations; there is no separate Barangay IDs module because ID cards are issuances. Nothing records sign-ins, failed logins or denied attempts yet (D-24). **Records Management, Residents tab, is connected** to `/api/v1/residents` (search, status filter and paging on the server; name search ignores case, accents, commas and spaces, so `Pena`, `Delacruz` and `Dela Cruz, Juan` all find the right person, and the same rule applies to the Issuance History and Barangay IDs searches (`backend/app/core/search.py`); add, edit, archive and restore; the profile shows sectors and the resident's issuance history). Archive and restore are Admin only. A possible duplicate asks for confirmation before saving. Not in this step: photo upload (the API takes PNG or WebP, the old photo helper accepts JPG or PNG), editing the Barangay ID number (set when an ID is issued), the resident-type filter (no API filter, D-48) and a per-resident ID status. **The Barangay IDs tab is connected** to `GET /api/v1/barangay-ids` (latest issued card per resident, status counts, server paging); the old registration, archived and override-validity items were removed because the API has nothing behind them. **The Family & Sector tab is partly connected:** it lists every sector with its number of active residents (`GET /api/v1/residents/sector-summary`) and, for the chosen sector, the active residents in it (`GET /api/v1/residents?sector_id=`), each with a View profile button that opens the profile on its Family & Sector tab. Sectors are still assigned in the resident form. The Family and Beneficiary cards stay disabled until the client lists the fields (D-20). The Import tab is described below; the other pages below are still prototype-only. **Issuance Management: the history part is connected** to `/api/v1/issuances` (summary cards, search by reference or resident name, document type and status filters, server paging, a details dialog, Void for Admin, and discarding a pending draft). The date filters were removed because the API has none. Edit, Continue and Reprint are not offered yet. **The New Issuance form is connected** to the same API (`src/components/Issuances/NewIssuance/issuanceApi.ts` turns the form's values into API calls): resident search and quick-add, drafts saved automatically, issue, and the resident photo (converted to PNG in the browser). Streets, sectors, ID types, purposes, associations and officials come from the server; a street or association that is not on the list can only be added by an Admin. The Barangay ID number is typed by the clerk (D-43). Printing reads the saved document; the clearance photo is not on the printed copy yet. The old in-memory copy of the API is kept in `issuanceApi.mock.ts` for the node tests only.
- **Officials (`/officials`) is connected** to `/api/v1/officials` (System Administrator only: add, edit, end term and reinstate; officials are never deleted). The New Issuance form reads the same list, so a current official added here appears as a signatory or First-Time Jobseeker witness; the page clears the form's cached lists after every change. Records and the remaining pages still show local rows where noted above.
- **Language switch (English / Filipino), step 13, in progress.** The profile menu's Language item now changes the interface language and the choice is saved in the browser (`localStorage` key `app-language`) and sets `<html lang>`. The interface starts in English and ignores the browser's own language. Strings live in `frontend/src/i18n/en.json` and `fil.json` (`tests/i18n.spec.ts` checks the two have the same keys). **Done so far:** sidebar, user menu, logout dialog, login page, footer buttons, the Dashboard, the Activity Log and all of Records Management (resident list, Add/Edit Resident form, resident profile, Barangay IDs and Lookup Lists). Stored values such as sex, civil status and resident type keep their English value in the database; only the shown label is translated. **Not yet translated:** every other page, the Get help, Learn more, Version, Terms and Privacy popups, page titles, toasts and server error messages. Printed documents are not affected by the interface language. **The Filipino text is a draft and must be reviewed by a Filipino speaker before it is shown to staff.**
- Issuance drafts are saved to the database (status draft) and show in the history as pending. A draft is not an official issuance until it is issued.
- The Document Management resident selector uses hard-coded sample residents; purposes are hard-coded.
- **Printing is implemented for six templates** (Clearance, Franchise, Electrical/Water, Indigency, Marginalized Sector, Assistance certification) as typed values on pre-printed forms, with a Printing setup dialog for calibration. Residency, First-Time Jobseekers and Barangay ID have no template. Details: [04-Documents-and-Printing.md](04-Documents-and-Printing.md). Not yet verified on a real printer.
- Masterlist import: **built end to end** (`/api/v1/imports`, see docs/09; tab in `components/Records/ImportMasterlistView.tsx`; report and summary card on the Reports page). Only the client answers (D-19: columns, fields to keep, duplicate rule) are open. The Dashboard has no import card.
- The account form maps **System Administrator → `is_superuser = true`** and **Staff → `is_superuser = false`**. The backend now has a `role` field (`admin` / `staff`); the form still sends `is_superuser`, which the API maps to the role. There is no pending or rejected state and none is planned (D-11).
- Backup/Restore screen runs manual backups, shows the real history, verifies and downloads files. Restore from the screen only checks a backup and shows the offline PowerShell command (typed `RESTORE` to continue); the schedule is read-only and is set on the server computer with `scripts\register-backup-task.ps1`.
- Account profile, password change and account management use the existing foundation functionality.
- The footer opens Version, Terms of Use and Privacy Policy popups. The legal text is a draft and is marked "Draft, pending barangay review"; it is not approved **(D-38)**.
- A public `/welcome` landing page with placeholder announcements and contact details exists from earlier work. Public content is **out of scope**. **Decision (Nov 1, 2026, D-27):** remove the public landing direction; entry goes to staff login. Placeholder contact details are never shown as facts. Done: `/welcome` now only redirects to `/login`.

**Design status:** the prototype was coded directly instead of being designed in Figma or similar, so wireframes, separate mockups, mobile mockups and client feedback do not exist (D-06; see section 8).

## 7. Creative Brief alignment (updated)

| Brief requirement | Prototype status | Remaining work |
|---|---|---|
| Dashboard: issued documents and expiring clearances/IDs | Connected to real totals (counts only); layout retained | Confirm periods and the 30-day window with the client **(D-21)** |
| Resident records: add, edit, search | List/profile draft with sample rows | Create/edit/profile actions and persistence; confirm search fields |
| Family, beneficiary, sector details | Draft tab | Confirm real fields and sector categories against the masterlists |
| Import masterlists | Built: backend, Records tab, Reports report and card | Client answers (D-19) |
| Resident and Barangay ID records | Records Management: Barangay IDs tab connected to the API (search, status filter, issue/expiry dates, status counts); Renew and Replace card open New Issuance for the ID type; no Create button | Numbering **(D-43)**; expiry rule **(D-18)**; photo upload; approved ID card layout **(D-44)** |
| Document request entry and editable purposes | Resident-first selector; purposes hard-coded | Connect to saved residents; maintainable purposes; persist requests |
| Separate issuance history with issue/expiry | Session-only history, no expiry shown | Persistent records, expiry where applicable, details, corrections preserving the original |
| Auto-filled printing on existing formats | Overlay printing implemented for six templates; calibration dialog | Calibrate on real paper/printer; templates for Residency, Jobseeker and Barangay ID |
| Scheduled and manual backup/restore | Concept screen exists; no automation | Wire to approved scripts; define schedule/destination; test restore |
| Fully offline LAN use | Deployment foundation exists | Test host startup, other-PC access, printers, firewall, recovery offline |
| Public features excluded | Welcome page removed (redirects to login) | Public/announcement direction removed; entry goes to staff login (D-27, done by Nov 7) |

## 8. Week 14 checklist

> **Status (D-06, Nov 1, 2026):** wireframes, full-color mockups, mobile mockups and client feedback were **not produced**. The design exists only as the coded `draft/admin-portal` prototype and the site map and style guide in this file. Proposed way to close the gap (not yet decided): ask Prof. Camba whether the prototype is accepted, and if not, make the mockups from prototype screenshots; either way, show the prototype to the client and record their feedback. Steps are in [08-Open-Decisions.md](08-Open-Decisions.md#d-06-follow-up-proposed-not-yet-decided).

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
7. Manually check dashboard, sidebar, login and user-account flows at **375px, 768px and 1280px**.
8. Test Staff and System Administrator views separately, including direct navigation to restricted routes.
9. Confirm role and authorization behavior **in the backend**, and audit logging, before any real data.
10. Replace fictional data only after an approved data plan exists. Do not claim client approval based on the prototype.
