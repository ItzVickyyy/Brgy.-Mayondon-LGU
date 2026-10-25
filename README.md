# Barangay Mayondon LGU – Web System

Final Project for **ITST301 Principles of Web Design**, **Integrative
Programming**, **Client-Server Technologies** and **Networking 2**. One system,
built for a real client: **Barangay Mayondon LGU, Los Baños, Laguna**.

BSIT major in Web and Mobile Application Development (WMAD) ·
Laguna State Polytechnic University – Los Baños Campus

| Member | Role |
|---|---|
| [Vic John O. Salen Jr.](https://github.com/ItzVickyyy) | Project Leader, Lead Developer |
| [Justin Adrian P. Reboton](https://github.com/jOstin-7) | Backend Developer, Technical Writer |
| [Jean Mervin G. Fajardo](https://github.com/JeanMervin) | Frontend Developer |

> **Status (October 25, 2026):** client interviews were conducted on October 19–20. The staff-only records and document-issuance scope and Creative Brief still await client review and signatures. The Foundation branch now has an initial Docker-based self-hosted LAN path, but the actual office deployment, offline workflows, backup/restore, security, and client approval remain unverified. See [Offline-LAN-Deployment.md](docs/Offline-LAN-Deployment.md), [Creative-Brief.md](docs/Creative-Brief.md), and [Source-of-Truth.md](docs/Source-of-Truth.md).

## Stack at a glance

FastAPI · SQLModel · local PostgreSQL · React · TypeScript · Vite ·
Tailwind CSS · shadcn/ui · Docker Compose for self-hosting. Full list in
[`docs/Complete-Tech-Stacks.md`](docs/Complete-Tech-Stacks.md).

## Run it locally

Requirements: [uv](https://docs.astral.sh/uv/) (Python environment and dependencies),
[Bun](https://bun.sh), and Docker for a local PostgreSQL database.

For local development with separate backend/frontend terminals, follow
[`docs/How-To-Start.md`](docs/How-To-Start.md). For the proposed packaged LAN setup
that serves the frontend and API together, follow [`docs/Offline-LAN-Deployment.md`](docs/Offline-LAN-Deployment.md).
The LAN deployment guide is a preparation guide, not proof of a verified client installation.

Log in with `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD` from the root `.env`.
There is no public sign-up: an admin creates accounts from the **Admin** page.

### Tests and checks

```bash
cd backend && uv run pytest                      # backend tests
cd frontend && bun run lint && bun run build     # lint + type-check + build
```

## Team workflow

Read [`docs/Developers.md`](docs/Developers.md) for the full team workflow,
branching strategy, review checklist, testing guidance, and developer roles.

**Current branch policy:** keep working on `Foundation` while the team reviews
the offline LAN preparation and obtains client approval. Do not rename or merge
this branch or create the planned `production` branch unless the team explicitly
reviews and changes the branch plan.

**Planned branch policy after client approval and team review:**
- `master` will be the integration branch for reviewed changes that pass the
  required checks.
- `production` will contain only approved, tested releases intended for
  deployment. Deployment remains unverified until the real hosting process is
  tested.
- Use short-lived `feature/`, `fix/`, `hotfix/`, `docs/`, and `chore/`
  branches for individual tasks, with pull requests and teammate review.

### Database and API changes

- Changed a model in `backend/app/models.py`? Create and inspect a migration:
  `cd backend && uv run alembic revision --autogenerate -m "what changed"`,
  then test it with `uv run alembic upgrade head`.
- Changed an API route or schema? Regenerate the typed client with
  `bash scripts/generate-client.sh` from the repository root.
- Never commit `.env`, passwords, secrets, or real resident data.

## Project layout

```
backend/    FastAPI app, database models, migrations, tests
frontend/   React app (branding in src/config/site.ts)
packages/   React Email templates for system emails
docs/       Source of truth, tech stack, developer and local startup guides, documentation index
scripts/    Client generation and test helpers
```

## License

MIT, inherited from the
[Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)
this project started from. See [LICENSE](LICENSE).
