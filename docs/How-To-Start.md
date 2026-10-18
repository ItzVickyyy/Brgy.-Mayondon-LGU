# How to Start the System Locally (Windows PowerShell)

This guide explains how to run the Barangay Mayondon LGU system on a Windows development computer. It starts PostgreSQL, applies database migrations, creates the initial administrator account, and runs the backend and frontend in separate PowerShell terminals.

Use this for local development only. The project remains on the `Foundation` branch while the team prepares for the client interview. Do not enter real resident information.

## 1. Required software

Install the following software before starting. Use the official download pages linked below.

| Software | What it is used for | Required setup |
|---|---|---|
| Windows 10 or Windows 11, 64-bit | Operating system for these instructions | Use Windows PowerShell. |
| [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) | Runs PostgreSQL in a container, so you do not need to install PostgreSQL separately | Start Docker Desktop before running Docker commands. Enable the WSL 2 backend when prompted or when required by your Windows setup. |
| [Git for Windows](https://git-scm.com/download/win) | Clones the repository and checks branches and changes | PowerShell can run the Git commands in this guide. Git Bash is not required for these PowerShell steps. |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Installs Python dependencies and runs the backend tools | The project requires Python 3.14. `uv` can provision the project Python version when needed. |
| [Bun](https://bun.sh/docs/installation) | Installs frontend packages and runs the Vite development server | Install Bun for Windows and reopen PowerShell after installation if the command is not recognized. |
| A modern web browser, such as [Microsoft Edge](https://www.microsoft.com/edge) or [Google Chrome](https://www.google.com/chrome/) | Opens the web system and API documentation | Use a current browser version. |

**Optional:** [Visual Studio Code](https://code.visualstudio.com/) or another code editor is useful for editing `.env` and source files. You do not need to install Node.js or PostgreSQL separately for the steps in this guide.

Verify the command-line tools in PowerShell:

```powershell
docker --version
uv --version
bun --version
git --version
```

If a command is not recognized, finish installing that software and reopen PowerShell. Docker Desktop must be running.

## 2. Open the project folder

Clone the repository if you have not already done so:

```powershell
git clone https://github.com/ItzVickyyy/Brgy.-Mayondon-LGU.git
```

Open the cloned `Brgy.-Mayondon-LGU` folder in File Explorer. To open PowerShell in that folder, right-click an empty area and choose **Open in Terminal**. Alternatively, open the folder in your code editor and use its integrated terminal.

Confirm the terminal is at the repository root, then check the branch and working tree:

```powershell
Get-Location
git branch --show-current
git status
```

The active branch should be `Foundation`. If you have local changes, inspect them before switching branches or pulling updates. Do not switch branches as part of this startup guide.

## 3. Create the local environment file

Run this command from the repository root. It creates `.env` only if the file does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open the root `.env` file in your editor and review its settings. The database URL and `POSTGRES_PASSWORD` must use matching credentials.

The example file contains development placeholders. The application warns if `SECRET_KEY` or the database password is `changethis`. These placeholders are for local setup only. Never deploy with them, commit `.env`, or share its contents. Use unique secrets before deployment and do not use real resident data during development.

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

On first startup, PostgreSQL may log that database `app` does not exist before creating it. If the logs then show `CREATE DATABASE` and the service becomes healthy, that initial message by itself does not mean startup failed.

## 5. Install backend dependencies

Open a second PowerShell terminal in the repository root using File Explorer's **Open in Terminal** option. Change to the backend directory with a relative path:

```powershell
Set-Location .\backend
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

Open a third PowerShell terminal in the repository root using File Explorer's **Open in Terminal** option. Keep this terminal at the root and run:

```powershell
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
| A command is not recognized | Check that the relevant software is installed, then reopen PowerShell. |
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
