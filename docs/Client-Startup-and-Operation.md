# Client Daily Startup and Operation

**Status:** Deployment requirement / target behavior. This document records the intended daily experience for Barangay Mayondon. Automatic startup, browser shortcuts, and client-site behavior have **not** yet been configured or verified. Do not describe them as completed until the team tests them on the intended host computer.

## 1. Goal

Configure the system once during installation so barangay staff do not need to open Docker Desktop manually, run terminal commands, start PostgreSQL separately, or configure the application each day.

The intended daily workflow is:

1. Turn on the designated main computer and sign in to Windows as required by the agreed setup.
2. Docker Desktop / its engine starts automatically.
3. Docker Compose starts the database and application containers automatically.
4. Wait for the application health check to pass.
5. Open the system from a desktop shortcut or browser bookmark. The host computer can use `http://localhost:8000`; other office computers use `http://<host-computer-LAN-IP>:8000`.
6. Staff sign in to the application and perform their work in the browser.

The same main computer may also be used as a clerk workstation. Other office computers do not need Docker or a separate PostgreSQL installation. They need a supported browser and access to the trusted local network.

## 2. One-time setup handled by the project team

Before handover, the team should:

- Install and configure Docker Desktop on the designated host computer.
- Copy the approved application deployment files and configure the local `.env` file with unique secrets.
- Build or prepare the required images and dependencies before the host is taken offline.
- Initialize PostgreSQL, apply database migrations, and create the approved administrator account.
- Configure Docker Desktop to start at the appropriate Windows sign-in/startup point.
- Verify that the Compose services use restart policies so they come back when the Docker engine starts.
- Confirm that the database is healthy before the backend starts, and that the backend health check becomes healthy.
- Create a desktop shortcut or bookmark for the local system address.
- If automatic browser opening is desired, configure it only after confirming that the application is ready; otherwise staff should open the shortcut after startup.
- Configure the Windows firewall and trusted local network for authorized office computers.
- Document the approved shutdown, restart, update, backup, restore, and troubleshooting procedures.

Do not put secrets, passwords, real resident data, or private backup files in the repository. Keep the real `.env` file on the host and restrict access to it.

## 3. Important startup details

Automatic container restart and automatic Docker Desktop startup are separate settings.

- A Compose restart policy such as `unless-stopped` helps restart containers when the Docker engine starts. It does not, by itself, guarantee that Docker Desktop starts when Windows starts.
- Docker Desktop startup behavior can depend on Windows sign-in and the configured user account. Test the exact behavior with the intended host computer and its normal shutdown/startup process.
- A browser shortcut does not start the server. The application must already be running and healthy.
- A browser opened too early may show a connection error. The user procedure should allow startup time, or the team may provide a tested readiness check before opening the browser.
- Do not store administrator credentials in a shortcut, script, or browser launch command.
- Do not disable Windows Defender Firewall to make LAN access work. Configure only the required access for the trusted private network.

If the client needs the application available before any user signs in to Windows, assess that requirement separately. Do not assume the current Docker Desktop setup provides unattended pre-login startup. Choose and test an appropriate supported arrangement before promising this behavior.

## 4. Expected daily operation

| Situation | Intended behavior | Verification required |
|---|---|---|
| Main computer is turned on | Docker engine and application services start without manual Docker commands | Restart the host and observe startup |
| Host application is ready | Staff can open the local system shortcut | Confirm login page loads |
| Another office computer opens the system | It reaches the same application and database through the LAN | Test from an actual second computer |
| Internet is unavailable | Local workflows continue if all required assets and services are local | Disconnect internet and test approved workflows |
| Host computer restarts | Services return and data persists | Restart and check login and test records |
| Docker or application fails to start | Staff follow a simple troubleshooting/escalation procedure | Test common failure messages and document recovery |
| Host computer is shut down | Other office computers cannot use the system | Explain host dependency to the client |

## 5. Client-facing instructions to prepare for handover

The user manual should include a short section with the final verified instructions:

- How to turn on and sign in to the host computer.
- How to tell whether the system is ready.
- How to open the system from a shortcut or bookmark.
- How staff on other computers open the system.
- What to do if the page does not load.
- Who is authorized to restart the application or host computer.
- How to contact the designated person responsible for technical support.
- The approved shutdown procedure at the end of the workday.

Write the final instructions only after the team verifies the real deployment. Keep technical Docker commands in a separate administrator troubleshooting section, not in the normal daily staff workflow.

## 6. Acceptance checklist before turnover

- [ ] The client approves the designated host computer and who is responsible for it.
- [ ] Docker Desktop / the engine starts as expected after a normal host startup and sign-in.
- [ ] Database and application containers start automatically without manual terminal commands.
- [ ] The backend health check becomes healthy after startup.
- [ ] The system opens from a desktop shortcut or bookmark.
- [ ] The host computer can also be used as a clerk workstation.
- [ ] At least one other authorized computer can access the same system through the LAN.
- [ ] Startup and normal operation work without internet, using only locally available resources.
- [ ] A host restart does not lose database data.
- [ ] Staff have simple instructions for readiness, access, and common problems.
- [ ] The team records any limitation that requires a Windows user to sign in before Docker starts.
- [ ] The team has separately tested and documented backup and recovery before real resident data is used.

## 7. Related project requirements

- **Client-Server Technologies:** host application, database service, client access, service readiness, and deployment.
- **Networking 2:** trusted LAN access, firewall rules, connectivity, and host availability.
- **Integrative Programming:** application/backend/database startup and persistence.
- **ITST301 Week 16 technology transfer:** clear user instructions, training, and handover documentation.

This document describes a target operating procedure, not proof of a finished or client-approved deployment. The signed Creative Brief, client approval, site-specific network checks, security review, testing, and technology-transfer requirements still apply.
