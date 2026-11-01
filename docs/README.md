# Documentation

Everything the team needs to know about the project lives in this folder, grouped by topic. Start with the open decisions if you are unsure what is still unsettled.

| File | Covers | Read it when |
|---|---|---|
| [01-Project-and-Schedule.md](01-Project-and-Schedule.md) | Project at a glance, team, subjects, schedule, weekly requirements, testing instruments, user manual, Certificate of Utilization, final report, grading, status, AI rules | Before any task; to check milestones and status |
| [02-Requirements-and-Scope.md](02-Requirements-and-Scope.md) | Final Creative Brief, client problem, objectives, scope and exclusions, features, FR/NFR, LGUSS-BIMS boundary, decisions made | Before designing or building anything; after client discussions |
| [03-Design-and-UI.md](03-Design-and-UI.md) | Site map, navigation, page layouts, style guide, Admin portal prototype status | Designing or changing the interface |
| [04-Documents-and-Printing.md](04-Documents-and-Printing.md) | Document types, fields, pre-printed form overlay rules, print templates | Working on issuance or printing |
| [05-Roles-Security-and-Privacy.md](05-Roles-Security-and-Privacy.md) | Roles and access plan, security checklist, privacy safeguards, verification status | Auth, permissions, data handling, before releases |
| [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md) | Tech stack, architecture, offline LAN deployment, backup/restore, packaging, daily startup | Planning or testing the client installation |
| [07-Developer-Guide.md](07-Developer-Guide.md) | Roles, branching, reviews, testing, migrations, local startup | Before development or a pull request |
| [08-Open-Decisions.md](08-Open-Decisions.md) | **Every undecided, vague or contradictory item**, with owner and deadline | After client or instructor discussions |

**Precedence if documents conflict:** the instructor's *Final Project Guide* → the signed Creative Brief (client scope) → these documents.

**Documentation is preparation, not proof.** Setup guides, checklists and design drafts describe what is planned. Nothing here proves a client-site installation, a verified deployment, client approval or a working feature unless it says so with evidence.

## Using an AI assistant

1. Open a new chat and paste `01-Project-and-Schedule.md`; add `02-Requirements-and-Scope.md` for client scope, `06-Architecture-and-Deployment.md` for technical work, or `07-Developer-Guide.md` for workflow.
2. Say your milestone and role, e.g. *"I'm Jean (frontend), Week 15: help me connect the resident list to the API."*
3. For code questions paste the relevant file or error. Treat answers as suggestions and check them against the Guide and the client-approved requirements.
4. Never paste passwords, `.env` contents, secrets or real resident data.

## Keeping the docs current

- Update the relevant file in the same pull request that changes a decision or workflow.
- When a decision is made, answer it in [08-Open-Decisions.md](08-Open-Decisions.md), move the answer into the file it affects, and mark the row Closed.
- Keep long material (interview notes, mockups, test results, narrative reports) in its own working file or the final report appendices.
- Edit documentation **only on `master`**; code changes go on `draft/admin-portal` (see [07](07-Developer-Guide.md)).
- Use clear file names and plain English.
