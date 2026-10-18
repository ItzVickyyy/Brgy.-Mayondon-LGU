# Documentation

Everything the team needs to know about the project lives in this folder.

| File | What it is | When to read it |
|---|---|---|
| [Source-of-Truth.md](Source-of-Truth.md) | Project requirements, schedule, grading, decisions, open items, and status | Before any task; check this after client discussions |
| [Developers.md](Developers.md) | Team roles, branch plan, workflows, reviews, testing, migrations, and security guidance | Before starting development or opening a pull request |
| [Complete-Tech-Stacks.md](Complete-Tech-Stacks.md) | Technologies, architecture, and Vercel + Supabase deployment notes | Before coding or planning deployment |

The root [README](../README.md) contains the single source for local setup and running instructions. Use its [Run it locally section](../README.md#run-it-locally) rather than maintaining duplicate setup instructions.

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

- Update documentation in the same pull request that changes a decision or workflow.
- Move items from "Open items" to "Decisions made" in `Source-of-Truth.md`
  only after they are confirmed. Update the status checklist and date as needed.
- Keep files focused. Interview notes, test results, mockups, and narrative
  reports belong in their appropriate working documents or final report appendices.
- Use clear file names and plain English.
