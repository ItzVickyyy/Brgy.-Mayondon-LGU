# Testing

Working files for the two instruments the Final Project Guide requires in Week 16 (testing and technology transfer). Decided Nov 1, 2026 (D-07). Restored and brought up to date on Nov 18, 2026 (patch 124): the first versions were removed on Nov 1 as outdated, and the links to this folder in docs/01, 02 and 08 had been left pointing at nothing.

| File | Instrument | Filled in by |
|---|---|---|
| [Instrument-A-Test-Cases.md](Instrument-A-Test-Cases.md) | A: Test Case Form | The group |
| [Instrument-B-User-Survey.md](Instrument-B-User-Survey.md) | B: User Evaluation Survey | The client and real users |

Rules:

- Use **fictional data only**. Never put real resident data, passwords, tokens, two-factor codes, recovery answers or backup keys in a test case, result or screenshot.
- Leave **Actual result** and **Pass/Fail** blank until the test is really run. Do not pre-fill results. A test that was not run is not a pass.
- Fix every failed test, retest, and record both results. Keep failed attempts as history.
- Record each defect wherever the team tracks them (the repository's bug log was removed Nov 1, 2026) and reference it in Remarks.
- The starter cases come from the Guide as summarized in [../01-Project-and-Schedule.md](../01-Project-and-Schedule.md) section 7, plus the safeguards the project added itself. The Guide itself is the authority; correct these files if they differ.
- Host, backup, restore, network and reboot checks have their own step-by-step sheet, [../11-Host-Checks.md](../11-Host-Checks.md). Instrument A points to it instead of repeating the steps. Copy each result into Instrument A when the check is run.
- The automated tests (backend `pytest`, frontend checks, CI) show that the code still behaves as written. They do **not** replace Instrument A, which is a hand test of the running system by a person.

Context: [../01-Project-and-Schedule.md](../01-Project-and-Schedule.md) section 7 · open items in [../08-Open-Decisions.md](../08-Open-Decisions.md) (D-07, D-41).
