# Barangay Mayondon LGU – Web System

Final Project for **ITST301 Principles of Web Design**, **Integrative
Programming**, **Client-Server Technologies** and **Networking 2**. One system,
built for a real client: **Barangay Mayondon LGU, Los Baños, Laguna**.

BSIT major in Web and Mobile Application Development (WMAD) ·
Laguna State Polytechnic University – Los Baños Campus

| Member | Role |
|---|---|
| Vic John O. Salen Jr. | Project Leader, Lead Developer |
| Justin Adrian P. Reboton | Backend Developer, Technical Writer |
| Jean Mervin G. Fajardo | Frontend Developer |

> **Status:** foundation only. The system's modules are decided after the
> client interview (Week 13). Everything about the project lives in
> [`docs/`](docs/README.md); start with
> [`docs/Source-of-Truth.md`](docs/Source-of-Truth.md).

## Stack at a glance

FastAPI · SQLModel · PostgreSQL (Supabase) · React · TypeScript · Vite ·
Tailwind CSS · shadcn/ui · Vercel. Full list in
[`docs/Complete-Tech-Stacks.md`](docs/Complete-Tech-Stacks.md).

## Run it locally

Requirements: [uv](https://docs.astral.sh/uv/) (installs Python 3.14),
[Bun](https://bun.sh), and Docker for a local PostgreSQL. On Windows, use
**Git Bash or WSL** for the `bash` commands.

```bash
cp .env.example .env              # then set real values for the secrets
docker compose up -d db           # local PostgreSQL

cd backend
uv sync
uv run bash scripts/prestart.sh   # migrations + first admin account
uv run fastapi dev                # API: http://localhost:8000  (docs: /docs)

# second terminal, from the repo root
bun install
bun run dev                       # frontend: http://localhost:5173
```

Log in with `FIRST_SUPERUSER` / `FIRST_SUPERUSER_PASSWORD` from your `.env`.
There is no public sign-up: an admin creates accounts from the **Admin** page.

### Tests and checks

```bash
cd backend && uv run pytest                      # backend tests
cd frontend && bun run lint && bun run build     # lint + type-check + build
```

## Team workflow

- `main` always works. Create a branch per task (`feat/<module>-<name>`), open
  a Pull Request, and have a teammate review before merging.
- Changed a model in `backend/app/models.py`? Create and commit a migration:
  `cd backend && uv run alembic revision --autogenerate -m "what changed"`, then
  `uv run alembic upgrade head`.
- Changed an API route or schema? Regenerate the typed client:
  `bash scripts/generate-client.sh`.
- Never commit `.env`, passwords or real resident data.

## Project layout

```
backend/    FastAPI app, database models, migrations, tests
frontend/   React app (branding in src/config/site.ts)
packages/   React Email templates for system emails
docs/       Source of truth, tech stack, documentation index
scripts/    Client generation and test helpers
```

## License

MIT, inherited from the
[Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)
this project started from. See [LICENSE](LICENSE).
