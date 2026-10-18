# How to Start the System Locally (Windows PowerShell)

This guide records the working local startup process tested on Windows with PowerShell. It starts the PostgreSQL database, applies database migrations, creates the initial administrator account, and runs the backend and frontend in separate terminals.

Use this for local development only. The project is still on the `Foundation` branch while the team prepares for the Barangay Mayondon LGU client interview. Do not enter real resident information.

## 1. Requirements

Install these tools and confirm they are available in PowerShell:

```powershell
docker --version
uv --version
bun --version
git --version
```

The tested setup used Docker, uv, Bun, and Git on Windows. Docker Desktop must be running.

## 2. Open the project and check the branch

Open PowerShell and go to the repository root. Adjust the path if you cloned the project elsewhere.

```powershell
cd C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU
git branch --show-current
git status
```

The active branch should be `Foundation`. If you have local changes, inspect them before switching branches or pulling changes. Do not switch branches as part of this startup guide.

## 3. Create the local environment file

At the repository root, copy the example file if you have not already created `.env`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `.env` in your editor and review the settings. The local database URL uses `POSTGRES_PASSWORD` in its password field. Keep these values consistent.

The example contains development placeholders. The application warns if `SECRET_KEY` or the database password is `changethis`. These placeholders are for local setup only. Never deploy with them, commit `.env`, or share its contents. Use unique secrets before deployment and do not use real resident data during development.

## 4. Start PostgreSQL

From the repository root, run:

```powershell
docker compose up -d db
docker compose ps
```

Wait until the `db` service shows as healthy. To inspect its logs:

```powershell
docker compose logs db
```

On the first startup, PostgreSQL may log that database `app` does not exist before it creates the database. If the logs then show `CREATE DATABASE` and the service becomes healthy, that initial message by itself does not mean startup failed.

## 5. Install backend dependencies

Open a second PowerShell window and go to the backend directory:

```powershell
cd C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU\backend
uv sync
```

Wait for dependency installation to finish.

## 6. Apply migrations and create the initial administrator

On Windows PowerShell, running the Bash prestart script with:

```powershell
uv run bash scripts/prestart.sh
```

may fail with `alembic: command not found`. If that happens, run the script's steps separately from the `backend` directory:

```powershell
uv run alembic upgrade head
uv run python app/initial_data.py
```

The first command applies database migrations. The second initializes the initial data, including the administrator account configured by `FIRST_SUPERUSER` and `FIRST_SUPERUSER_PASSWORD` in the root `.env` file.

Wait for both commands to finish without errors. To check the applied migration:

```powershell
uv run alembic current
```

The output should show the current revision. The revision can change when new migrations are added, so do not expect a particular revision ID forever.

## 7. Start the backend API

Still in the backend directory, run:

```powershell
uv run fastapi dev
```

Keep this terminal open. The API should be available at:

- API: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

A successful startup includes a message similar to `Application startup complete`. Requests to `/docs` and `/api/v1/openapi.json` should return HTTP 200.

## 8. Install and start the frontend

Open a third PowerShell window and return to the repository root:

```powershell
cd C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU
bun install
bun run dev
```

Keep this terminal open. Open the local URL Vite prints, usually:

http://localhost:5173/

A Vite message recommending `@vitejs/plugin-react` is a performance suggestion. It does not, by itself, mean the frontend failed to start.

## 9. Log in and verify the system

1. Open http://localhost:5173/ in your browser.
2. Use the administrator email and password configured in the root `.env` as `FIRST_SUPERUSER` and `FIRST_SUPERUSER_PASSWORD`.
3. Do not guess credentials or paste passwords into project documentation.
4. If the page does not load or login fails, check the browser Console with F12 and inspect the frontend and backend terminal output.
5. If the API is not responding, verify that the backend terminal is still running and open http://localhost:8000/docs.

The repository does not provide public self-registration by default. An administrator creates additional accounts.

## 10. Common problems

| Problem | What to do |
|---|---|
| `alembic: command not found` from `prestart.sh` | From `backend`, run `uv run alembic upgrade head`, then `uv run python app/initial_data.py`. |
| Database connection error | Check `docker compose ps`, database logs, and the root `.env` database settings. Confirm the database service is healthy. |
| `SECRET_KEY` or database password warning | Check the root `.env`. Development placeholders may produce warnings. Replace them before deployment; never use them with real client data. |
| Frontend opens but API requests fail | Keep the backend running, check its terminal for errors, and inspect the browser Console and Network tabs. |
| Port is already in use | Identify and stop the other local process using the port before restarting the service. Do not randomly change ports without also updating related configuration. |
| Migration reports an error or multiple heads | Stop and share the full error with the team. Do not delete migration files, reset the database, or force a migration without reviewing the cause. |

## 11. Stop the local system

Press `Ctrl+C` in the frontend and backend terminals. To stop the database container but keep its data, run from the repository root:

```powershell
docker compose stop db
```

Do not run `docker compose down -v` unless you deliberately intend to delete the local database volume and its data.

## Before any client deployment

The local setup is not proof that production deployment is ready. Before using real client data, the team must replace development secrets, verify hosting and network configuration, review authentication and access controls, plan backups, test the complete system, and agree on privacy handling with the client. Follow the Data Privacy Act of 2012 and the client's approved requirements.

## Milestone relevance

This guide supports local development for **Integrative Programming** (backend, database, migrations, and initial data) and **Client-Server Technologies** (running and checking the API and frontend). It prepares the team for the Week 15 demonstration, but it does not replace client-approved requirements, testing, deployment, or Networking 2 work at the client's site.
