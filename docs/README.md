# Documentation

Everything the team needs to know about the project lives in this folder.

| File | What it is | When to read it |
|---|---|---|
| [Source-of-Truth.md](Source-of-Truth.md) | Project requirements, schedule, grading, decisions, open items, and status | Before any task; check this after client discussions |
| [Creative-Brief.md](Creative-Brief.md) | Interview-based scope, objectives, features, exclusions, platform preference, content, timeline, and approval fields | Use as the current draft; client review and signatures are still required |
| [Developers.md](Developers.md) | Team roles, branch plan, workflows, reviews, testing, migrations, and security guidance | Before starting development or opening a pull request |
| [How-To-Start.md](How-To-Start.md) | Tested Windows PowerShell steps to start PostgreSQL, migrate and initialize the database, and run the backend and frontend | When setting up or running the project locally |
| [Complete-Tech-Stacks.md](Complete-Tech-Stacks.md) | Technologies, architecture, and Vercel + Supabase deployment notes | Before coding or planning deployment |
| [Security-Measures.md](Security-Measures.md) | Recurring security checklist; production hosting verification is explicitly pending | During development, before releases, and before handling real data |
| [Developers-Journal/README.md](Developers-Journal/README.md) | Rules and individual journals for recording work, achievements, AI tools, and workflow with date/time | Every time you work on the project |
| [Bug-and-Issue-Log.md](Bug-and-Issue-Log.md) | Central record of bugs, defects, incidents, and issues found during development, testing, or launch | Whenever an issue is found or its status changes |
| [System-Specification-and-Architecture.md](System-Specification-and-Architecture.md) | Single reference combining client-confirmed requirements, scope, roles, technical architecture, sitemap, database, security, hosting, and open decisions | Before design or implementation changes, and after client discussions or technical decisions |

Use [How-To-Start.md](How-To-Start.md) as the detailed, tested guide for running the system in Windows PowerShell. The root [README](../README.md#run-it-locally) links to it for quick access.

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
- Move items from "Open items" to "Decisions made" in `Source-of-Truth.md`
  only after they are confirmed. Update the status checklist and date as needed.
- Keep files focused. Interview notes, test results, mockups, and narrative
  reports belong in their appropriate working documents or final report appendices.
- Use clear file names and plain English.
