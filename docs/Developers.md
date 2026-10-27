# Developer Guide

This guide explains how our three-person team works on the Barangay Mayondon LGU Web System. Follow it together with the project source of truth and the repository's existing setup instructions.

## 1. Read these first

1. [Project Source of Truth](Source-of-Truth.md) for the current status, decisions, open questions, milestones, and client requirements.
2. [Complete Tech Stacks](Complete-Tech-Stacks.md) for the architecture, technology choices, and deployment notes.
3. [Root README](../README.md) for the local setup, test commands, and project structure.

**How to run the project:** follow [How-To-Start.md](How-To-Start.md) for local development. For the proposed self-hosted LAN package, follow [Offline-LAN-Deployment.md](Offline-LAN-Deployment.md). That guide is preparation only until the packaged app is built and tested without internet on the target network.

## 2. Team responsibilities

| Member | Main responsibility | Expected contributions |
|---|---|---|
| Vic John O. Salen Jr. | Project Leader, Full Stack Developer | Coordinate tasks and milestones while contributing to frontend, backend, database integration, authentication, deployment, testing, and technical decisions. |
| Justin Adrian P. Reboton | Backend Developer, Technical Writer | Focus on backend logic and APIs, database models and migrations, backend tests, and accurate technical documentation. Coordinate backend changes with both full-stack developers. |
| Jean Mervin G. Fajardo | Full Stack Developer | Contribute to both frontend and backend implementation, with particular ownership of UI/UX, responsive layouts, frontend behavior, API integration, and related tests. |

Responsibilities are areas of ownership, not permission to ignore code outside your assigned area. Discuss changes that affect another person's work before implementing them.

## 3. Current project stage

The team is working on the `Foundation` branch after client interviews on October 19–20, 2026. The revised Creative Brief supplied on October 27 was reviewed by the professor and is reflected in [Creative-Brief.md](Creative-Brief.md). Verify the required client and group leader signatures on the copy retained for submission. The client prefers fully offline LAN operation. The repository has an initial Docker Compose deployment path using local PostgreSQL and FastAPI-served frontend assets, documented in [Offline-LAN-Deployment.md](Offline-LAN-Deployment.md). It still needs a full build, no-internet testing, LAN/firewall testing, backup/restore verification, and client-site validation.

Until the Creative Brief and architecture are reviewed:
- Keep the repository on `Foundation`; do not rename or merge it or create the future `production` branch.
- Update [Source-of-Truth.md](Source-of-Truth.md) and the system specification when a decision is confirmed.
- Record remaining questions rather than guessing, especially around the local host, LAN access, photo background removal, the approved full-access account requirement, and backups.
- Reconcile the current Admin/Staff authorization model with the revised Creative Brief's requirement that all six staff accounts have full access.
- Do not describe the local LAN preparation as production-ready or as verified at the client site.

## 4. Agreed branching strategy

The team plans to use two long-lived branches when the team is ready to adopt the reviewed release workflow:

| Branch | Purpose | Rules |
|---|---|---|
| `master` | Integration branch for reviewed work | Contains features that have passed review and required checks. It is not automatically considered production-ready. |
| `production` | Release and deployment branch | Contains only a tested, approved release intended for deployment. Deploy from this branch only after the hosting and deployment process is verified. |

The names and roles above are the planned workflow. **At present, continue using `Foundation`** as requested. Do not rename it, merge it into `master`, or create `production` unless the team explicitly reviews and changes the branch plan.

Use short-lived branches for individual tasks:

- `feature/<short-name>` for a new feature, such as `feature/announcements`
- `fix/<short-name>` for a bug fix, such as `fix/login-error`
- `hotfix/<short-name>` for an urgent issue in a released system
- `docs/<short-name>` for documentation, such as `docs/developer-guide`
- `chore/<short-name>` for maintenance, such as `chore/update-dependencies`

Keep each branch focused on one task. Avoid combining unrelated features, cleanup, and documentation changes in the same pull request.

### Normal feature workflow (once the branching strategy is active)

1. Check the task and acceptance criteria with the team. Verify that the work matches client-approved requirements.
2. Update your local repository and start from the latest `master`.
3. Create a task branch with the appropriate prefix.
4. Implement the smallest complete change. Add or update tests and documentation when needed.
5. Run the relevant checks locally.
6. Push the branch and open a pull request targeting `master`.
7. Explain what changed, why it changed, how it was tested, and any known limitations.
8. Ask a teammate to review the change. The author should not approve their own pull request.
9. Fix review feedback and wait for required CI checks to pass.
10. Merge only when the reviewer is satisfied and the checks pass. Resolve conflicts deliberately, then re-run affected checks.

### Release workflow

1. Confirm that the integrated `master` version matches client-approved requirements and is ready for release testing.
2. Test the complete system, including backend, frontend, database migrations, integration paths, and the deployment configuration.
3. Open a release pull request from `master` to `production`.
4. Review the release scope, test evidence, migration and rollback considerations, secrets/configuration, and deployment checklist.
5. Merge only after the release is approved and required checks pass.
6. Deploy from `production` only after the actual hosting process has been verified.
7. Record the deployed version and any deployment issues. If a hotfix is needed, apply it to the release branch and then bring the fix back into `master`.

A branch named `production` does not itself prove that the system is deployed or operational. Record deployment as complete only after verifying it.

### Hotfix workflow

For an urgent defect in a deployed release, create `hotfix/<short-name>` from `production`, make and test the smallest safe fix, and open a pull request to `production`. After the release fix is approved and merged, ensure the same fix is included in `master`. Do not use a hotfix branch for ordinary unfinished features.

## 5. Review and pull request checklist

Before requesting review, confirm:

- [ ] The change addresses a clear task and does not invent a client requirement.
- [ ] The change is limited to its intended scope.
- [ ] Relevant backend, frontend, integration, and end-to-end tests were added or updated.
- [ ] Linting, type checks, builds, and relevant tests pass locally.
- [ ] CI checks for the pull request pass.
- [ ] Database migrations and generated API client files are included when applicable.
- [ ] Documentation is updated where behavior, setup, decisions, or workflows changed.
- [ ] No secrets, real resident information, or private client data are included.
- [ ] The pull request description explains the change and its test evidence.

Do not merge a failing check just to keep moving. Investigate the failure, fix it, or document why a check is unrelated and get the team's agreement before proceeding.

## 6. Testing commands

Use the root README's setup instructions first. The common checks are:

```bash
# Backend tests
cd backend
uv run pytest

# Frontend lint, type checks, and production build
cd frontend
bun run lint
bun run build
```

Run Docker Compose and Playwright checks when a change affects container setup, full-stack integration, authentication, routing, or user workflows. Check the GitHub Actions results for the exact commit being reviewed. A previous green run does not verify a new commit.

## 7. Database and API changes

### Database models and migrations

If a database model changes, review the impact on existing data and create a migration. From the backend directory:

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Inspect the generated migration before committing it. Autogeneration is a starting point, not a guarantee that the migration is correct. Test upgrades against a local development database and coordinate schema changes with teammates. Do not use real resident data for development tests.

### API routes and generated client

If an API route or schema changes, check its callers and update tests. Regenerate the typed frontend client using the repository's existing script:

```bash
bash scripts/generate-client.sh
```

Run this script from the repository root in an environment that supports Bash. Review the generated diff and test the frontend against the updated API contract.

## 8. Security and resident privacy

- Never commit `.env`, credentials, API keys, access tokens, or production secrets.
- Use `.env.example` for variable names and safe placeholders only.
- Do not put real resident data, screenshots containing personal information, or client records into issues, test fixtures, commits, or public documentation.
- Use test data that is fictional and clearly marked.
- Apply least privilege to accounts and database access. Do not expose administrative functions to public users.
- Validate inputs on the server and enforce authorization on the backend, not only by hiding frontend controls.
- Follow the Data Privacy Act of 2012 and the client's approved handling requirements for personal information.
- Before any real deployment, verify hosting suitability, access controls, backups, HTTPS, secrets, and the actual deployment procedure with the team and client.

## 9. Communication and documentation

- Discuss changes that cross frontend, backend, database, or deployment boundaries before coding.
- Keep pull requests small enough for another member to review.
- Record confirmed client decisions in [Source-of-Truth.md](Source-of-Truth.md). Clearly mark unresolved questions.
- Update documentation in the same pull request as the behavior or workflow it describes.
- If the team falls behind the project schedule, tell Vic early and arrange an instructor consultation rather than silently dropping required work.
- Every member should be able to explain the parts they implement and help test the integrated system.

## 10. Developer journals

Every developer must maintain their own journal in [Developers-Journal](Developers-Journal/README.md). Record work **every time you work on this project**, including small tasks, investigations, bugs found, fixes, reviews, decisions, tests, documentation, and achievements. Keep entries factual and add them as soon as practical so details are not lost.

Each entry must include:
- The date, time, and timezone. Use the actual local time when writing the entry. If recording historical work and the time is unknown, write `Time not recorded` instead of guessing.
- What you worked on and why.
- What you personally did and what was achieved, including relevant file paths or commit/PR links when available.
- Tests/checks performed and their actual results. Clearly label checks not run or still pending.
- AI tools used, how they were used, and the important parts of your prompting/review workflow. If no AI tool was used, say so.
- Blockers, decisions, follow-up work, and links to relevant bug/issue records when applicable.

Use the shared [Journal Template](Developers-Journal/Journal-Template.md). Keep each member's notes in their own journal:
- [Vic's Journal](Developers-Journal/Vic%27s-Journal.md)
- [Justin's Journal](Developers-Journal/Justin%27s-Journal.md)
- [JM's Journal](Developers-Journal/JM%27s-Journal.md)

The journal is a working record, not a place for secrets. Never record passwords, tokens, API keys, private environment values, or real resident personal data. Do not claim another member's work as your own. Distinguish personal contributions from team achievements and AI-generated suggestions. Record the AI tool by name and describe how you used it, but do not paste confidential prompts or sensitive context.

## 11. Milestone alignment

This guide supports the team's ongoing development workflow. After the client interview, use the [Source of Truth](Source-of-Truth.md) and the Final Project Guide to connect each task to its milestone and the relevant subject:

- **ITST301 Principles of Web Design:** client requirements, Creative Brief, sitemap, wireframes, mockups, style guide, responsive UI, usability, and documentation.
- **Integrative Programming:** backend logic, database design, API behavior, and module integration.
- **Client-Server Technologies:** client-server communication, configuration, deployment, and data exchange.
- **Networking 2:** network setup, connectivity, security, and operation at the client's site.

Do not mark a milestone complete until its required work and client approvals are actually completed.
