# Host checks (barangay PC)

Nothing in this file has been run yet. It is the checklist for the first time the system is installed on the real server computer. Each check says what to do, what a pass looks like, and where to write the result. **A check that was not run is not a pass**; record failures too.

Use synthetic data only until the real-data gate (D-40) is passed. Run PowerShell from the repository folder unless a step says otherwise.

## A. Backup, wipe and restore (D-35)

Why: a backup that was never restored is not a recovery plan.

1. Start the app: `docker compose -f compose.yml up -d`. Sign in as the System Administrator. Add one test resident ("Test Resident One").
2. Open **Backup and Restore** and press **Back up now**. Pass: a row appears with status **Verified**, and a `mayondon-db-….dump` file exists in `backups\` on the host.
3. Press **Verify file** on that row, then **Download copy**. Pass: both succeed and the downloaded file is the same size as the one in `backups\`.
4. Make a second change that the backup does not contain: add "Test Resident Two".
5. Select the backup, press **Prepare Restore**, type `RESTORE`, press **Check and Show Command**. Pass: the page shows `.\scripts\restore-db.ps1 -BackupFile .\backups\…` and nothing has changed yet (Resident Two is still there).
6. Run that command in PowerShell and type `RESTORE` when asked. Pass: the script ends without an error and restarts the backend.
7. Sign in again. Pass: Resident One is there, Resident Two is gone, issuance history and the Activity Log open normally. (The backup history shows only what the backup knew; that is expected.)
8. Make a new backup after the restore and confirm it is **Verified**.

### Scheduled backup

1. Register the task: `.\scripts\register-backup-task.ps1 -Time 17:00` (add `-CopyTo "E:\MayondonBackups"` when the external drive is plugged in; use the real drive letter).
2. Start it now: `Start-ScheduledTask -TaskName "Mayondon Database Backup"`. Wait a minute.
3. Pass: `backups\last-run.json` says `"ok": true`, a new row with type **Scheduled** appears on the page, and (with `-CopyTo`) the file is also on the external drive.
4. Leave it for two days. Pass: one new scheduled backup per day, and no more than 14 files in `backups\` (and in the copy folder).
5. Negative test: stop Docker Desktop, start the task again. Pass: `last-run.json` says `"ok": false` with a readable message, no crash.
6. Decide with the barangay: the task runs only while the Windows user is signed in (default). `-RunWhetherLoggedOn` also runs it signed out but only works if Docker Desktop is running then; test it before relying on it.
7. Remove it if needed: `.\scripts\register-backup-task.ps1 -Unregister`.

Open client answers (D-35): the real schedule, which drive and who keeps it, how many copies, and whether backup files must be protected (D-33). The defaults are daily, 14 copies, `backups\`.

## B. Docker Desktop starts at Windows sign-in (D-34)

1. Check Docker Desktop's licence terms for the client's use.
2. Restart Windows and sign in. Do not open Docker Desktop yourself.
3. Pass: Docker Desktop starts by itself, the containers come up (`restart: unless-stopped`), `Invoke-WebRequest http://localhost:8000/api/v1/utils/health-check/` returns 200 and the login page loads. Write down the time from sign-in to ready.
4. Restart again and do **not** sign in. Record whether the app is reachable from another PC. Availability before sign-in is not promised until this passes.

## C. Access from a second PC (D-31, D-32)

1. On the host, find its IPv4 address (`ipconfig`).
2. On another PC on the same network open `http://<host-IPv4>:8000`. Pass: the login page loads; sign in as staff, open Records, Issuances and the Dashboard.
3. Put the host to sleep, wake it, reload from the second PC. Then restart the host and try again. Record what happens.
4. Ask the network administrator to reserve the host's IP address in the router.

## D. Printer sharing (D-32)

1. Share the printer from the host, or install it on each workstation.
2. Print a test page from the second PC. Pass: it prints. (Aligning real documents is printing step 17, later.)

## E. Firewall (D-31, D-32)

1. Windows Defender Firewall stays **on**. Allow inbound TCP 8000 on the **Private** profile only.
2. From the second PC: `Test-NetConnection <host-IPv4> -Port 8000` must succeed and `Test-NetConnection <host-IPv4> -Port 5432` must **fail** (PostgreSQL is bound to `127.0.0.1` in `compose.yml`).

## F. First set-up on a new installation (administrator)

A fresh database is empty. Do these once, signed in as the System Administrator, before staff start work.

1. **Streets.** Staff cannot add streets (only the administrator can). Open the resident form and check the street list; if it says no streets have been added, add every street and purok of the barangay first. Without them residents cannot be saved with an address and the masterlist import rejects every street.
2. **Staff accounts.** Add User creates the account with the default password and a forced change at first sign-in. Create each account with the person present, hand over the default password in person and let them change it at once. The account is active by default; untick "Is active?" only to hold an account back.
3. **Locked accounts.** After repeated wrong passwords an account locks for a while. The Users table shows "Locked until"; Edit User has "Unlock this account", which leaves the password alone.
4. **Camera for photos.** The browser allows the camera only on `localhost` or over HTTPS. On the plain-HTTP office network a second PC cannot take photos with the camera (uploading a file still works); take Barangay ID photos on the host PC until HTTPS is set up. Record what you find.
5. **Change every default secret** in `.env` before real data goes in (`FIRST_SUPERUSER_PASSWORD`, `SECRET_KEY`, the database password) and leave `FASTAPI_ENV` and `ENABLE_DEV_ROUTES` blank.
6. **After every update, restart the backend.** If a button answers "Method Not Allowed" or "No API route POST /api/...", the running backend is older than the screens (for example Backup and Restore without the create-backup route). Rebuild and restart it (`docker compose build backend && docker compose up -d`) and try again.

## Result sheet

Copy this table into a new file or the final report and fill it in.

| Check | Date | Who | PC model / Windows version | Pass / fail | Notes (time to ready, errors, what failed) |
|---|---|---|---|---|---|
| A. Backup, wipe, restore | | | | | |
| A. Scheduled backup (2 days) | | | | | |
| A. Copy to external drive | | | | | |
| B. Docker auto-start (signed in) | | | | | |
| B. After reboot, no sign-in | | | | | |
| C. Second PC access | | | | | |
| C. After sleep / reboot | | | | | |
| D. Printer from second PC | | | | | |
| E. Port 8000 open, 5432 closed | | | | | |
| F. Streets added, accounts created, secrets changed | | | | | |
