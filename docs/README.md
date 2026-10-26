# Documentation

Everything the team needs to know about the project lives in this folder.

| File | What it is | When to read it |
|---|---|---|
| [Source-of-Truth.md](Source-of-Truth.md) | Project requirements, schedule, grading, decisions, open items, and status | Before any task; check this after client discussions |
| [Creative-Brief.md](Creative-Brief.md) | Interview-based scope, objectives, features, exclusions, platform preference, content, timeline, and approval fields | Use as the current draft; client review and signatures are still required |
| [Developers.md](Developers.md) | Team roles, branch plan, workflows, reviews, testing, migrations, and security guidance | Before starting development or opening a pull request |
| [How-To-Start.md](How-To-Start.md) | Windows PowerShell steps to run the development setup with separate backend and frontend terminals | When developing locally |
| [Offline-LAN-Deployment.md](Offline-LAN-Deployment.md) | Initial Docker-based self-hosting setup for an office LAN without internet, including host setup, firewall, offline limitations, and deployment verification | When preparing and testing the proposed client-site installation |
| [Client-Startup-and-Operation.md](Client-Startup-and-Operation.md) | Target one-time setup and simplified daily operation: automatic service startup, browser shortcut, host-computer role, and handover checklist | When planning client-friendly startup and technology transfer |
| [Complete-Tech-Stacks.md](Complete-Tech-Stacks.md) | Technologies and architecture, including the original online Foundation setup and the local deployment option | Before coding or planning deployment |
| [Security-Measures.md](Security-Measures.md) | Recurring security checklist; production hosting verification is explicitly pending | During development, before releases, and before handling real data |
| [Developers-Journal/README.md](Developers-Journal/README.md) | Rules and individual journals for recording work, achievements, AI tools, and workflow with date/time | Every time you work on the project |
| [Bug-and-Issue-Log.md](Bug-and-Issue-Log.md) | Central record of bugs, defects, incidents, and issues found during development, testing, or launch | Whenever an issue is found or its status changes |
| [System-Specification-and-Architecture.md](System-Specification-and-Architecture.md) | Single reference combining client-confirmed requirements, scope, roles, technical architecture, sitemap, database, security, hosting, and open decisions | Before design or implementation changes, and after client discussions or technical decisions |

Use [How-To-Start.md](How-To-Start.md) as the detailed guide for running the development setup in Windows PowerShell. For the proposed offline client installation, read [Offline-LAN-Deployment.md](Offline-LAN-Deployment.md). For the intended staff-facing startup experience and acceptance checks, read [Client-Startup-and-Operation.md](Client-Startup-and-Operation.md). These are preparation documents, not proof of a verified client installation.

## Using an AI assistant (free tiers)

1. Open a new chat and paste the contents of `Source-of-Truth.md`. Add
   `Complete-Tech-Stacks.md` for technical architecture or `Developers.md`
   for team workflow.
2. Say which milestone and role you are working on, for example: *"I'm Jean
   (frontend), Week 14: help me plan the sitemap for the pages we decided on."*
3. For code questions, paste the relevant file or error message.
4. Treat answers as suggestions. Check them against the Final Project Guide,
   the client-approved requirements, and your instructors.
5. Never paste passwords, `.env` contents, secrets, or real resident data.

## Keeping the docs current

- Update documentation in the same pull request that changes a decision or workflow. The interviews on October 19–20, 2026 established a draft clerical records and document-issuance scope. The client prefers fully offline LAN operation, which conflicts with the current online-oriented Foundation hosting plan. Keep this conflict visible until resolved.
- Keep the simplified startup behavior documented as a target until it is configured and tested. Do not claim automatic startup, browser shortcuts, or client-site readiness are complete before verification.
- Move items from "Open items" to "Decisions made" in `Source-of-Truth.md`
  only after they are confirmed. Update the status checklist and date as needed.
- Keep files focused. Interview notes, test results, mockups, and narrative
  reports belong in their appropriate working documents or final report appendices.
- Use clear file names and plain English.
