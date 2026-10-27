# Full Stack FastAPI Template

[![Test Docker Compose](../../actions/workflows/test-docker-compose.yml/badge.svg)](../../actions/workflows/test-docker-compose.yml)
[![Test Backend](../../actions/workflows/test-backend.yml/badge.svg)](../../actions/workflows/test-backend.yml)

## Project Foundation: Barangay Mayondon Records and Document Issuance System

This repository is being adapted for a student-developed records and document issuance system for Barangay Mayondon LGU, Los Baños, Laguna. The client’s confirmed workflow and approved Creative Brief take priority over assumptions made during development. Confirm changes to scope, data fields, issuance rules, user permissions, and deployment with the client before implementation.

### Existing LGUSS-BIMS Context

On October 27, 2026, the barangay contact told the team that LGUSS-BIMS was an old system and was no longer being used by the barangay. This records the client’s statement only. It does not establish that DILG has discontinued LGUSS-BIMS or that the system is unavailable to other barangays.

The DILG Memorandum Circular 2025 on LGUSS-BIMS is a reference for understanding barangay information-management and data-protection concerns. This student project is a separate local system. Do not claim that it replaces, complies with, or integrates with LGUSS-BIMS. No data synchronization or integration with LGUSS-BIMS is assumed.

### Data Protection and Security Baseline

The system may handle residents’ personal information and records of document issuance. Apply the following safeguards during design, implementation, testing, deployment, and handover. These are project requirements to implement and verify, not claims that every safeguard is already in place.

- **Collect only necessary data.** Store fields needed for the barangay’s confirmed workflows. Do not add sensitive fields without a clear operational need and client approval.
- **Use individual staff accounts.** Do not use shared logins. The current Creative Brief describes six staff accounts with full access. Before finalizing permissions, confirm which staff genuinely need functions such as editing, deleting, exporting records, managing accounts, and viewing sensitive information. Keep individual accountability even if the client confirms broad access.
- **Protect authentication.** Use the framework’s password-hashing functionality. Never store plaintext passwords or commit credentials, secret keys, production database details, or real resident data to the repository. Use environment variables for secrets and protect authentication endpoints against repeated login attempts.
- **Enforce authorization on the backend.** Every protected API operation must verify the authenticated user’s permission. Hiding a button in the interface is not access control. Prevent unauthorized viewing, editing, deletion, printing, and exporting of records.
- **Keep an accountability trail.** Record important actions such as creating or updating resident records, issuing documents, and deleting or exporting data. Where appropriate, include the acting account, action, target record, and timestamp. Do not put unnecessary personal information or passwords in logs.
- **Protect data in transit and on the host.** Keep the application and database accessible only to intended office devices and services. Configure the host firewall and restrict database and administration ports from ordinary client devices. Use HTTPS where the deployment supports it, and secure the host computer with an account password, updates, and restricted physical access.
- **Back up and restore safely.** Support the agreed local backup process, restrict access to backup media, and protect backup files from unauthorized access. Test restoration before turnover and periodically thereafter. A backup is not considered reliable until a restore has been tested. Confirm who is responsible for the backup drive and backup schedule.
- **Manage staff changes.** Provide a way to disable or remove access when a staff member leaves, is reassigned, or no longer needs the system. Do not delete issuance history merely because an account is deactivated.
- **Handle documents and exports carefully.** Limit who can access generated files and resident lists. Avoid leaving exports or temporary files on shared desktops. Printed documents, signatures, and dry seals remain subject to the barangay’s approved process and physical safeguards.
- **Set privacy and retention practices with the client.** Explain the system’s purpose and the information it stores to authorized users. Confirm who may access the data, how long records and backups must be kept, and how corrections or deletion requests should be handled. Follow applicable privacy requirements, including the Data Privacy Act of 2012 (Republic Act No. 10173).
- **Use safe development and testing data.** Prefer synthetic or masked resident records during development, demonstrations, screenshots, and issue reports. Do not place production data in public repositories, sample files, or test fixtures.
- **Test security and recovery.** In addition to normal feature testing, verify failed login handling, logout and session protection, attempts to access records without permission, invalid input handling, record deletion controls, backup restoration, and whether unintended devices can reach the host or database. Fix failures and retest before turnover.

### Deployment Assumptions and Limitations

The approved Creative Brief describes an offline system hosted on one designated office computer and accessed by authorized computers on the barangay’s local network, with backups to an external drive. Confirm the actual host, office network, firewall, backup location, and responsible staff before installation. Offline operation does not by itself make the system secure; access to the host, database, backups, and physical documents must still be controlled.

Do not claim penetration testing, a formal Privacy Impact Assessment, encryption at rest, production-grade monitoring, or full compliance with any standard unless the team has actually completed and documented the relevant work. Record known limitations and handover responsibilities in the project documentation.

## Technology Stack and Features

- ⚡ [**FastAPI**](https://fastapi.tiangolo.com) for the Python backend API.
  - 🧰 [SQLModel](https://sqlmodel.tiangolo.com) for the Python SQL database interactions (ORM).
  - 🔍 [Pydantic](https://docs.pydantic.dev), used by FastAPI, for the data validation and settings management.
  - 💾 [PostgreSQL](https://www.postgresql.org) as the SQL database.
- 🚀 [React](https://react.dev) for the frontend.
  - 🧩 Built into the backend application and served by FastAPI on the same domain as the API.
  - 💃 Using TypeScript, hooks, [Vite](https://vitejs.dev), and other parts of a modern frontend stack.
  - 🎨 [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) for the frontend components.
  - 🤖 An automatically generated frontend client.
  - 🧪 [Playwright](https://playwright.dev) for end-to-end testing.
  - 🦇 Dark mode support.
- ☁️ [FastAPI Cloud](https://fastapicloud.com) for deployment.
- 🐋 [Docker Compose](https://www.docker.com) for local services and self-hosted deployment.
  - 📞 [Traefik](https://traefik.io) as a reverse proxy with automatic HTTPS.
- 🔒 Secure password hashing by default.
- 🔑 JWT (JSON Web Token) authentication.
- 📫 Email-based password recovery.
- ✉️ [React Email](https://react.email) for email templates.
- 📬 [Mailpit](https://mailpit.axllent.org) for local email testing during development.
- ✅ Tests with [Pytest](https://pytest.org).
- 🏭 CI (continuous integration) and CD (continuous deployment) based on GitHub Actions.

### Dashboard Login

![Dashboard login screenshot](img/login.png)

### Dashboard - Admin

![Admin dashboard screenshot](img/dashboard.png)

### Dashboard - Items

![Items dashboard screenshot](img/dashboard-items.png)

### Dashboard - Dark Mode

![Dark mode dashboard screenshot](img/dashboard-dark.png)

### React Email Templates

![Email templates screenshot](img/react-email.png)

### Mailpit - Local Email Testing

![Mailpit screenshot](img/mailpit.png)

### Interactive API Documentation

![API docs](img/docs.png)

## How to Use It

Click the **Use this template** button at the top of this page to create a new repository.

## Backend Development

Backend docs: [backend/README.md](./backend/README.md).

## Frontend Development

Frontend docs: [frontend/README.md](./frontend/README.md).

## Deployment

FastAPI Cloud deployment: [deployment.md](./deployment.md).

Self-hosted deployment with Docker Compose: [deployment-docker-compose.md](./deployment-docker-compose.md).

## Development

General development docs: [development.md](./development.md).

This includes the local FastAPI and Vite workflow, Docker Compose services, `.env` configuration, and more.

## Release Notes

Check the file [release-notes.md](./release-notes.md).

## License

The Full Stack FastAPI Template is licensed under the terms of the MIT license.
