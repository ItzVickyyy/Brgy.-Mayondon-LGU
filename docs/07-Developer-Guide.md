# 07 · Developer Guide

How the three-person team works: reading order, branching, reviews, testing, database/API changes, and how to run the system locally. Combines the former Developers guide and How-To-Start.

Undecided items are tagged `(D-xx)`; see [08-Open-Decisions.md](08-Open-Decisions.md).

Last updated: November 5, 2026

## 1. Read these first

1. [01-Project-and-Schedule.md](01-Project-and-Schedule.md) — status, milestones, instructor requirements.
2. [02-Requirements-and-Scope.md](02-Requirements-and-Scope.md) — what the client asked for.
3. [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md) — stack, architecture, offline LAN deployment.
4. The root [README](../README.md) — setup commands and project layout. (`frontend/src/config/site.ts` still points to a non-existent `docs/ROADMAP.md`; **D-09** is done: the pointer has been removed from the code.)

Run locally: section 9 below. Package for the office LAN: [06-Architecture-and-Deployment.md](06-Architecture-and-Deployment.md) (preparation only until built and tested offline on the target network).

## 2. Team responsibilities

| Member | Main responsibility | Expected contributions |
|---|---|---|
| Vic John O. Salen Jr. | Project Leader, Full Stack Developer | Coordinate tasks and milestones; frontend, backend, database integration, authentication, deployment, testing, technical decisions |
| Justin Adrian P. Reboton | Backend Developer, Technical Writer | Backend logic and APIs, models and migrations, backend tests, accurate technical documentation; coordinate backend changes with both full-stack developers |
| Jean Mervin G. Fajardo | Full Stack Developer | Frontend and backend work with particular ownership of UI/UX, responsive layouts, frontend behavior, API integration and related tests |

Responsibilities are areas of ownership, not permission to ignore other code. Discuss changes that cross frontend, backend, database or deployment boundaries **before** coding. If the team falls behind, tell Vic early and arrange an instructor consultation rather than silently dropping required work. Every member should be able to explain what they implemented.

## 3. Current stage

Client interviews were held October 19–20, 2026. The Creative Brief is final (signed by the professor). The client prefers fully offline LAN operation; an initial Docker path exists but still needs a full build, no-internet testing, LAN/firewall testing, backup/restore verification and client-site validation.

Until the architecture is validated at the client site:

- Update the docs when a decision is confirmed; record open questions rather than guessing (host computer, LAN access, photo background removal, the full-access account requirement, backups).
- Reconcile the proposed Admin/Staff model with the brief's six full-access accounts **(D-10)**.
- Never describe the LAN preparation as production-ready or verified.

## 4. Branching

> **Decided Nov 1, 2026 (D-08).** The old documents disagreed on branches (old Source of Truth and README: work on `Foundation`; old Developers guide and branch-sync workflow: `master` for docs, `draft/admin-portal` for UI). The team settled it as follows:
>
> - **`master`** holds documentation and planning.
> - **`draft/admin-portal`** holds the UI and supporting code, and **the Version 1 demo runs from it**.
> - **`Foundation`** is frozen as a read-only reference. As of Nov 1 it contained no commit that `master` lacks (check with `git rev-list --count origin/master..origin/Foundation` before relying on this). Do not commit to it, rename it or delete it.
> - The planned `production` branch is still not created.
>
> The root README was updated to match.
>
> **Update Nov 7, 2026 (D-08):** the owner merged `draft/admin-portal` into `master` (pull request #9, merge commit `18f4a02`). `master` now holds the application code **and** the documentation, and the Version 1 demo runs from `master`. `draft/admin-portal` is not ahead of `master`. The interim arrangement below was written for the time before that merge and **no longer applies** (rules 1 to 4 and the file-ownership table); it is kept as history. Until the team decides otherwise, use the workflow in the next paragraph. The **Branch sync check** workflow enforced those old rules and would have failed any code change on `master`, so it was **retired on Nov 7, 2026** (the file `.github/workflows/branch-sync-check.yml` is deleted). The **Verify offline deployment** workflow now also runs on pushes and pull requests for `master`.
>
> **Working now:** cut a short-lived `feature/`, `fix/`, `docs/` or `chore/` branch from `master`, open a pull request, and merge it after the checks pass. Code and documentation may change in the same pull request.

### Interim arrangement (superseded on Nov 7, 2026; kept as history)

| Branch | Holds | Never changes |
|---|---|---|
| `master` | Documentation and planning: everything in `docs/`, the root `README.md`, and the branch-sync workflow (retired Nov 7, 2026) | Application code, tests, lock files, other workflows |
| `draft/admin-portal` | Admin portal UI, layout, design, and the code and tests that support it | `docs/` and the root `README.md` |

1. Edit documentation **only on `master`**; edit application code **only on `draft/admin-portal`**.
2. Never copy documentation between branches. Bring docs into `draft/admin-portal` by merging:
   ```bash
   git checkout draft/admin-portal
   git fetch origin
   git merge origin/master
   git push origin draft/admin-portal
   ```
   Do this after every docs commit on `master`.
3. Do **not** merge `draft/admin-portal` into `master` under this interim arrangement.
4. If a change needs both docs and code: docs first on `master`, merge `master` into `draft/admin-portal`, then make the code change.

The **Branch sync check** workflow (`.github/workflows/branch-sync-check.yml`, **deleted Nov 7, 2026**) used to run on every push to either branch. It failed if a branch changed files it did not own or if merging the two would conflict, and warned when `draft/admin-portal` was behind `master`.

### Planned workflow (after client approval and team review)

| Branch | Purpose | Rules |
|---|---|---|
| `master` | Integration branch for reviewed work | Features that passed review and required checks; not automatically production-ready |
| `production` | Release/deployment branch | Only tested, approved releases; deploy only after the hosting process is verified |

Do not create `production`, rename `Foundation`, or merge `Foundation` into `master` unless the team explicitly reviews and changes the plan. Short-lived task branches: `feature/`, `fix/`, `hotfix/`, `docs/`, `chore/` + a short name. Keep each branch to one task.

**Feature workflow:** check the task and acceptance criteria against client-approved requirements → start from the latest `master` → create a prefixed branch → implement the smallest complete change with tests/docs → run checks → push and open a PR to `master` explaining what, why, how tested and known limits → a teammate reviews (never approve your own PR) → fix feedback and wait for CI → merge only when satisfied; resolve conflicts deliberately and re-run affected checks.

**Release workflow:** confirm `master` matches client-approved requirements → test the complete system (backend, frontend, migrations, integration, deployment config) → release PR `master` → `production` reviewed for scope, evidence, migration/rollback, secrets/config and checklist → merge after approval and passing checks → deploy only after the real process is verified → record the version and any issues. A branch named `production` does not prove anything is deployed.

**Hotfix:** branch `hotfix/<name>` from `production`, make and test the smallest safe fix, PR to `production`, then ensure the fix is in `master`. Not for unfinished features.

## 5. Review and pull-request checklist

- The change addresses a clear task and invents no client requirement; it stays in scope.
- Relevant backend, frontend, integration and end-to-end tests added or updated.
- Lint, type checks, builds and relevant tests pass locally, and CI passes for the PR's **exact commit** (a previous green run does not verify a new commit).
- Migrations and generated API client files are included when applicable.
- Docs updated where behavior, setup, decisions or workflows changed.
- No secrets, real resident information or private client data.
- The PR description explains the change and its test evidence.

Do not merge on a failing check to keep moving. Investigate, fix, or document why it is unrelated and get the team's agreement.

## 6. Testing commands

```bash
# Backend tests
cd backend && uv run pytest

# Frontend lint, type check, production build
cd frontend && bun run lint && bun run build
```

Run Docker Compose and Playwright checks when a change touches container setup, full-stack integration, authentication, routing or user workflows.

**Frontend build notes.** The route tree is generated during the build, so run `bun run build` first, then `bunx tsc -p tsconfig.build.json --noEmit`. Biome reports pre-existing formatting and import-sort noise; ignore it unless you touched those lines.

**Print and form unit-style specs** (Playwright files in `frontend/tests/`, no login needed): `print-data.spec.ts`, `print-overlay.spec.ts`, `print-calibration.spec.ts`, `print-load.spec.ts`, `photo-upload.spec.ts`, `issuance-schema.spec.ts`. Run them with `bunx playwright test tests/<file>`. Documentation-only changes need no build or tests.

**Tests changed by the Records Management merge:** `admin-portal-pages.spec.ts` now expects the "Records Management" heading on `/records` and that `/barangay-ids` redirects to `/records?view=barangay-ids`. `welcome.spec.ts` tests the Welcome page copy; check it before renaming anything on that page.

## 7. Database and API changes

**Models:** review the impact on existing data and create a migration.

```bash
cd backend
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Inspect the generated migration — autogenerate is a starting point, not a guarantee. Test upgrades on a local development database, coordinate schema changes with teammates, and never test with real resident data.

**API routes/schemas:** check callers, update tests, then from the repo root (in a Bash-capable environment) regenerate the typed client and review the diff:

```bash
bash scripts/generate-client.sh
```

## 8. Security and privacy rules for contributors

- Never commit `.env`, credentials, API keys, tokens or production secrets; `.env.example` holds names and safe placeholders only.
- No real resident data, screenshots with personal data or client records in issues, fixtures, commits, journals or docs. Use clearly marked fictional data.
- Least privilege; do not expose admin functions publicly. Validate input and enforce authorization **on the backend**.
- Follow the Data Privacy Act of 2012 and the client's approved handling requirements. Full checklist: [05-Roles-Security-and-Privacy.md](05-Roles-Security-and-Privacy.md).

## 9. Run the system locally (Windows PowerShell)

For local development with separate backend and frontend terminals. **Do not enter real resident information.** Do not switch branches as part of this guide.

### 9.1 Required software

| Software | Used for | Notes |
|---|---|---|
| Windows 10/11, 64-bit | OS for these steps | Use Windows PowerShell |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Runs PostgreSQL in a container | Start it first; enable the WSL 2 backend when prompted |
| [Git for Windows](https://git-scm.com/download/win) | Clone, branches, changes | Git Bash not required |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Python dependencies and backend tools | Project needs Python 3.14; `uv` can provision it |
| [Bun](https://bun.sh/docs/installation) | Frontend packages and Vite dev server | Reopen PowerShell if not recognized |
| Edge or Chrome | Open the system and API docs | Current version |

Optional: VS Code. You do not need Node.js or a separate PostgreSQL install. Verify with `docker --version`, `uv --version`, `bun --version`, `git --version`.

### 9.2 Steps

1. **Open the project.** `git clone https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU.git`, open the folder in a terminal, and check `Get-Location`, `git branch --show-current`, `git status`. Inspect local changes before switching or pulling anything. *(Use `master` for code, docs and the demo since the Nov 7, 2026 merge; see section 4. The old guide said `Foundation`; ignore that.)*
2. **Create `.env`** from the repo root (only if missing):
   `if (-not (Test-Path .env)) { Copy-Item .env.example .env }`
   Review it; the database URL and `POSTGRES_PASSWORD` must match. The `changethis` placeholders warn and are for local setup only — never deploy with them, commit `.env` or share it.
3. **Start PostgreSQL** (repo root): `docker compose up -d db` then `docker compose ps`. Wait for `db` to be healthy (`docker compose logs db` to inspect). A first-start "database `app` does not exist" message followed by `CREATE DATABASE` and a healthy service is normal.
4. **Install backend dependencies** (second terminal): `Set-Location .\backend` then `uv sync`.
5. **Migrate and create the admin.** `uv run bash scripts/prestart.sh` may fail on Windows with `alembic: command not found`. Then run, from `backend`:
   `uv run alembic upgrade head` and `uv run python app/initial_data.py`.
   The second creates the admin from `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD`. Check with `uv run alembic current`.
6. **Start the API:** `uv run fastapi dev` — API at `http://127.0.0.1:8000`, interactive docs at `http://127.0.0.1:8000/docs`. Expect "Application startup complete".
7. **Start the frontend** (third terminal, repo root): `bun install` then `bun run dev`; open `http://localhost:5173/`. A Vite message recommending `@vitejs/plugin-react` is a suggestion, not a failure.
8. **Log in** with `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD` from `.env`. Do not guess credentials or paste passwords into docs. There is no public sign-up; an administrator creates accounts. If the page or login fails, check the browser Console (F12) and both terminals; confirm `http://localhost:8000/docs` responds.

**Stop:** `Ctrl+C` in the frontend and backend terminals; `docker compose stop db` keeps data. **Never run `docker compose down -v`** unless you intend to delete the local database volume.

> Local development uses plain `docker compose`, which loads `compose.override.yml` (Adminer, Mailpit, etc.). The **client install must use `-f compose.yml`** — see [06](06-Architecture-and-Deployment.md).

### 9.3 Common problems

| Problem | What to do |
|---|---|
| Command not recognized | Finish installing the software, reopen PowerShell |
| `alembic: command not found` from `prestart.sh` | From `backend`, run `uv run alembic upgrade head` then `uv run python app/initial_data.py` |
| Database connection error | Check `docker compose ps`, db logs and the `.env` database settings |
| `SECRET_KEY` / password warning | Development placeholders warn; replace before deployment; never with real data |
| Frontend loads but API fails | Keep the backend running; check its terminal and the browser Console/Network tabs |
| Port already in use | Find and stop the other process; don't change ports without updating related config |
| Migration error or multiple heads | Stop and share the full error with the team; do not delete migrations, reset the database or force a migration |

## 10. Records: journals and issue log

The developer journals (`docs/Developers-Journal/`) and the bug and issue log (`docs/Bug-and-Issue-Log.md`) were **removed from the repository on Nov 1, 2026** by team decision. They remain in git history before that commit. Decide where defects found during testing will be recorded; Instrument A retests need a defect reference. Never put secrets or real resident data in any record the team keeps.

## 11. Milestone alignment

- **ITST301 Principles of Web Design:** requirements, Creative Brief, sitemap, wireframes, mockups, style guide, responsive UI, usability, documentation.
- **Integrative Programming:** backend logic, database design, API behavior, module integration. (Local startup supports this.)
- **Client-Server Technologies:** client-server communication, configuration, deployment, data exchange. (Local startup supports this.)
- **Networking 2:** network setup, connectivity, security and operation at the client's site.

Do not mark a milestone complete until its required work **and** client approvals are actually done. The local setup prepares the Week 15 demo but does not replace client-approved requirements, testing, deployment or Networking 2 work.
