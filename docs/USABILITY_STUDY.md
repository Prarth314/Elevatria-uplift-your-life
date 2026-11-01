# Usability study kit — not yet performed

Status: **prepared; no participants or results**. Automated tests cannot establish usefulness, user satisfaction, or productivity improvement.

## Questions to test

1. Can a person explain why one task is placed and why another remains unplaced without assuming the app proved global infeasibility?
2. Can they distinguish their accepted schedule from a proposal and change circumstances without unintentionally replacing accepted work?
3. Can they recover their work after a reload or save warning?
4. Does the resulting plan feel feasible for their week, and what makes it useful or unhelpful?

Recruit 3–5 willing peers with different scheduling habits for a formative 20–30 minute study. Include keyboard-only use and a small-screen session where feasible; this small convenience sample does not represent a market.

## Consent and privacy

Explain: “This is a student project test, not an evaluation of you. Participation is voluntary; you may skip any step or stop. Use a fictional or nonsensitive goal. Data stays in this browser unless you choose to export it. We will record anonymous observations, not account credentials or the content of your personal plans.”

Ask separately before recording screen/audio. Default to no recording. Use participant codes such as P01; do not put names, emails, school schedules or private goals in Git. Store consent and raw observations privately outside the repository. Agree on a retention period (suggest 30 days), deletion method and whether anonymized quotations may be shared. Supabase sign-in is not part of this study until hosted verification is complete.

## Task script (avoid coaching unless stuck)

1. Define a goal you could finish in a few weeks. Choose a deadline and realistic weekly budget. Use synthetic content if the goal is personal.
2. Create/edit at least three tasks and a prerequisite. Explain what the estimate means. Add one inspiration note.
3. Set work windows and one commitment. Generate a proposal. Before clicking accept, explain what is saved and what is only proposed.
4. Find a placement detail and unplaced item. Tell us what affected them, whether another arrangement might work, and one adjustment to try.
5. Accept, reload and locate your work. Mark a task complete, then reopen it. Explain progress and remaining effort.
6. Your available hours are reduced. Use My week changed, protect a task if appropriate, review the comparison and either accept or discard. Try undo if accepted.
7. Export a JSON backup, review its restoration and cancel once before restoring. Explain what restoring replaces. Download ICS and explain what it does **not** synchronize.
8. Optional facilitator scenario: another synthetic tab changes the board. Find the recovery/export path. Do not clear real user storage or force actual disk exhaustion.

After each task ask “What did you expect?” and “What would you do next?” After the session ask which step was useful, which was confusing, what would prevent reuse, and whether they would use it for a real plan. Do not promise outcome improvement.

## Private observation template

| Participant code | Device/input | Task | Complete / partial / failed | Independent / prompted | Elapsed seconds (optional) | Confusion/error | Severity | Suggested change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P__ | __ | __ | __ | __ | __ | No personal plan text | __ | __ |

Record observed behavior separately from the participant's opinion and your interpretation. Note if the facilitator intervened, if the app failed, and whether the person understood unplaced work as a heuristic result. Keep an issue table with reproduction, frequency among this sample, severity, proposed fix, and retest result. A “3 of 5” observation is not an estimate of population success.

## Decision rule

First fix data-loss risks, accidental acceptance and inability to complete core steps. Next improve repeated comprehension failures. Revisit solver quality only with a reproducible plan and clear unmet need. Run the same task again after changes. Publish only consented, anonymized findings with sample size, recruitment bias and limitations; until then the study remains unperformed.
