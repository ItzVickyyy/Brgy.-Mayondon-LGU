# 12. The development database (sample data)

The real system holds real residents. For development, testing and screenshots use a
second, completely separate stack with made-up data. It has its own project name
(`mayondon-dev`), database volume, image (`backend-dev`), backups folder
(`backups-dev/`) and ports, so nothing you do there can reach the real data.

| | Real system | Development stack |
|---|---|---|
| Compose project | `brgy-mayondon-lgu` | `mayondon-dev` |
| Database | `app` on port 5432 | `app_dev` on port 5433 |
| Address | `http://127.0.0.1:8001` / HTTPS | `http://127.0.0.1:8002` |
| Settings file | `.env` | `.env.dev` (copy of `.env.dev.example`) |
| Backups | `backups/` | `backups-dev/` |

## Start it

```powershell
cd C:\Users\vocjo\Projects\Brgy.-Mayondon-LGU
.\scripts\dev-db.ps1 up
```

The first run copies `.env.dev.example` to `.env.dev`, builds the `backend-dev` image,
starts the database, creates the two sample accounts and adds the sample data
(8 streets, 10 officials, 400 residents, about 6 in 100 archived). Open
`http://127.0.0.1:8002`. Other commands: `down` (stop, keep the data), `reset` (delete the
sample database and make a new one), `psql`, `logs`.

## Rules

- Never copy real resident data into this stack. Sample names are invented but common
  names can match real people by chance.
- `python -m app.sample_data_cli` refuses to run unless the database name ends in `_dev`,
  and refuses when residents already exist.
- Run the backend tests only against the development database. Their cleanup deletes all
  residents, issuances and accounts. `tests/conftest.py` refuses a database that is not
  named `*_dev` or `*_test` (the CI runner and `ALLOW_TESTS_ON_THIS_DATABASE=1` are the only
  exceptions).

## Work on the code against the sample database

Anything you start on your own Windows computer reads the real `.env`, which points at
the REAL database on port 5432. Override it in that PowerShell window first:

```powershell
$env:DATABASE_URL = "postgresql://postgres:dev-sample-db-password@localhost:5433/app_dev"
cd backend
..\.venv\Scripts\python.exe -m pytest tests          # tests, on the sample database
..\.venv\Scripts\python.exe -m fastapi dev app/main.py --port 8003   # a backend with hot reload
```

For the Vite dev screen (`bun run dev` in `frontend`), set
`$env:VITE_API_URL = "http://localhost:8003"` (or `8002` to use the Docker sample backend)
in the window that starts it. Use the password from your `.env.dev` if you changed it.
After changing code, `.\scripts\dev-db.ps1 up` rebuilds the sample backend image.
