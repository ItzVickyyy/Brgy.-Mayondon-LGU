# Documentation

Everything the team needs to know about the project lives in this folder.

| File | What it is | When to read it |
|---|---|---|
| [Source-of-Truth.md](Source-of-Truth.md) | Project requirements, schedule, grading, decisions, open items, status | Before any task; paste it into an AI chat for context |
| [Complete-Tech-Stacks.md](Complete-Tech-Stacks.md) | Every technology and version, architecture, Vercel + Supabase deployment checklist | Before coding or deploying |

The root [README](../README.md) has the quick start for running the project locally.

## Using an AI assistant (free tiers)

1. Open a new chat and paste the contents of `Source-of-Truth.md`. Add
   `Complete-Tech-Stacks.md` if the question is technical.
2. Say which milestone and role you are working on, for example: *"I'm Jean
   (frontend), Week 14: help me plan the sitemap for the pages we decided on."*
3. For code questions, paste the relevant file or error message.
4. Treat answers as suggestions: check them against the Guide and your instructors.
5. Never paste passwords, `.env` contents or real resident data.

## Keeping the docs current

- Update the docs in the same pull request that changes a decision.
- Move items from "Open items" to "Decisions made" in `Source-of-Truth.md` and
  update the status checklist and the "Last updated" date.
- Keep files short. Long or temporary material (interview notes, test results,
  mockups) belongs in the final report appendices; link it from here if needed.
- One topic per file, `Title-Case-With-Dashes.md` names, written in plain English.
