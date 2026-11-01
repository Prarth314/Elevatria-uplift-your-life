# Engineering milestone evidence

Reviewed November 1, 2026. This report supersedes older verification counts and limits where explicitly stated. It is evidence of implementation and engineering checks, not of user usefulness, satisfaction, or production-scale operation.

## Assessment and executed priorities

Inspection started from commit `21780c4` and a clean tree. No applicable AGENTS.md was found in the project or parent instruction locations. The baseline had 46 passing tests, frontend/server type checks and a successful production build. React/Vite, strict TypeScript, the pure domain, worker scheduler, independent validator, recovery, JSON/ICS and optional Supabase API/SQL architecture were retained. The active local workflow does not need Motoko, an account, an AI API or a paid service. Legacy prototype screens are not evidence of active functionality.

| Requested area | Initial classification | Work/evidence in this milestone | Actual result and limitation |
| --- | --- | --- | --- |
| Goal/task/dependency editing | Implemented and previously verified | Retained; built-browser create/edit and cyclic-edge rejection | Works with keyboard controls; date-then-other-field regression found and fixed using input events |
| Domain semantics | Implemented but insufficiently specified | [Planning contract](PLANNING_MODEL.md), explicit estimate/notes/progress copy | Goal-only deadlines, binary completion and full remaining estimate; no partial time logging |
| Hard constraints | Implemented and tested | Existing randomized DAG suite, full DST gap/fold commitment checks, minimum-fragment check and cached/fresh validator parity | Generated/current accepted allocations checked independently; exhaustive test demonstrates a feasible ordering EDF can miss |
| Placement explanation | Missing detailed facts | Window/effort/deadline/cap/prerequisite/session facts, explicit task-order policy | Facts verified against output; no exact rejection trace or unsupported causal claim |
| Unplaced explanation | Implemented but coarse | Total minutes, supported adjustments, proven no-window/deadline versus heuristic outcomes | Distinguishes a run's failure to place from global infeasibility; does not isolate every bottleneck |
| Replan review | Implemented; incomplete comparison | Retained/changed/new/removed summary and before/after unplaced effort; earlier deadlines | Recovery protects whole-task allocations for one proposal; not global minimum disruption |
| Proposal lifecycle | Implemented but insufficiently tested | Shared acceptance boundary, edit-triggered abort, post-await abort guard, worker revision/invariant checks, generation/recovery concurrency controls | Stale/malformed replies rejected; accepted state kept separate; browser accept/reload/undo/discard confirmed |
| Worker reliability | Implemented but little lifecycle coverage | Controlled-clock cancellation/timeout/start/clone/message/error tests; actual worker-entry integration and restart | All cleanup paths tested; no timing threshold pretending to prove speed |
| Local persistence | Implemented; storage-event race remained | Shared Web Lock + observed-value comparison, obsolete-request guard and memory-only fallback; concurrent-writer/quota tests | Coordinated current-app tabs cannot both pass check/write; outside writers/old versions do not participate in this lock |
| Corrupt/unsupported/recovery data | Implemented and tested | Retained bounded loading/validation, safe saved/working export paths and injected storage failures | No automatic migration or silent reset; real hardware interruption/quota exhaustion not forced |
| JSON backup/restore | Implemented and previously verified | Stale-read/preview guard, explicit replacement summary, accepted/dependency round trips | Actual downloaded synthetic 2-goal/18-task board validated and restored through preview |
| ICS artifacts | Implemented; parser verification missing | Development-only ical.js parser, Unicode/escaping/folding/DST/split identity tests, current-accepted export boundary | Actual download: 10 events, 10 distinct UIDs, exact title/start/end match to accepted schedule; remote Calendar import/sync unverified |
| Optional accounts | Implemented, live verification requires access | Existing verified identity, service isolation, adapter limits and actual SQL migrations rerun | Synthetic service users and embedded PostgreSQL passed; no live Supabase/OAuth project configured |
| Accessibility/responsiveness | Implemented; partial manual evidence | Form naming, keyboard goal/task/progress, focus restoration, reduced-motion CSS retained, extra focus selectors and darker helper text | Desktop/mobile core controls checked; not a full WCAG or screen-reader certification |
| Performance | Tooling existed, evidence incomplete | Seeded multi-goal sparse/dense/deep workloads, warm-up/distributions/clock/environment/source metadata, cold/warm worker bridge and I/O boundaries | [Measured results](BENCHMARKS.md); browser main-thread paint/long-task profiling remains unmeasured |
| User validation | Requires human participation | [Task script, consent/privacy template, observations and hypotheses](USABILITY_STUDY.md) | Prepared, unperformed; no invented participant metrics |
| AI/live Calendar/partial time logs | Missing and outside this milestone | Deferred deliberately | Not claimed as implemented; keep focus on planning quality and failure recovery |

## Automated checks actually executed

`npm run typecheck`, `npm test`, `npm run build`, `npm run audit -- --history --dist`, `pnpm audit --audit-level low` and `git diff --check` passed locally. **61 tests passed, none skipped.** The audit had zero high-confidence credential findings; seven contextual email matches were existing synthetic security fixtures/history and a historical public dependency contact. Pattern scans cannot establish the absence of every secret/PII format. No service secrets were configured, displayed or committed.

The final build has a separate scheduling worker, lazy account SDK and self-hosted fonts. The new calendar parser is a development dependency and is not part of the frontend bundle. Final remote CI and push status are reported with the delivered commits, separately from local success.

The tests now cover direct scheduler invariants, seeded random DAGs, an independent bounded exhaustive counterexample, actual worker module validation/restart, transport termination/cancellation/timeout/invalid replies, stale acceptance after goal/completion/estimate/dependency changes, locked concurrent writes and stale queued requests, storage failure preservation, portability parsing, owner isolation and PostgreSQL permission/revision/rate-limit behavior. Existing SQL/service tests execute real migration SQL in PGlite with synthetic roles; they are not hosted Supabase verification.

## Built-browser record

Only synthetic plans and the included sample were used on a loopback production preview with the intended CSP. The synthetic test board was restored to the sample afterward.

- Created a second goal, generated its editable plan and scheduled competing goals using Monday work windows. Opened placement details and inspected explicit unplaced minutes and heuristic caveats.
- Accepted, reloaded and observed saved allocations. Proposed a deadline seven days earlier; the comparison showed the proposed date and allocation changes before acceptance. Accepted then undid, restoring the earlier board/schedule.
- Completed a task with Space, observed effort-weighted progress and stale Calendar blocking. Attempted a cyclic prerequisite edit; rejection kept the editor and board. Escape restored focus to the task opener.
- Reproduced and fixed date loss when changing the date before another field; final built editor saved November 15 and three hours together correctly.
- Downloaded real JSON and ICS through UI controls. Independently parsed both, validated the board/allocation, counted ten unique events and compared each event to the reviewed accepted schedule. Restored the JSON through the visible preview.
- A second tab changed a synthetic goal; the first displayed working/saved export and reload options. The latest build also saved through Web Locks and survived reload. Automated queued-concurrency tests exercise the no-event-arrived case and unsupported/rejected coordination.
- Desktop 1440×1000 and mobile 390×844 had no page-wide horizontal overflow (1425/375 CSS content widths excluding scrollbars). Core fields had native labels or accessible names. Mobile goal/task/proposal controls were inspected. Reduced motion support exists in CSS; OS screen-reader compatibility and every contrast pair remain manual work.
- Final fresh-build browser error query returned no entries. Local ignored screenshots are `artifacts/engineering-desktop.png` and `artifacts/engineering-mobile.png`; no personal plan content was captured.

## External and human verification still required

1. Follow [CLOUD_SETUP.md](CLOUD_SETUP.md) using a free development project, both migrations and two disposable accounts. Verify OAuth callback/refresh/expiry, save/load/update/stale conflict/delete, cross-account denial and sign-out during pending operations through the hosted gateway. Account-level deletion and operational backup recovery also remain separate work.
2. Run a real calendar-client import/reimport test, including changed split counts and removed events. Stable file identities are not durable remote synchronization.
3. Run the prepared usability study, a screen-reader session and a broader accessibility review. No participant evidence exists yet.
4. Measure browser worker startup/clone/validation plus main-thread paint and long tasks on representative low-end devices. Node worker_threads measurements are explicitly a bridge, not native browser latency. Large image-rich backup performance remains bounded but unprofiled.
5. Do not mix old uncoordinated app versions with current tabs. Browser clearing, external scripts and device failures remain outside the coordinated-save guarantee; retain exports.

## Portfolio framing based on verified work

Suggested résumé bullets (adapt wording to your contribution history):

- Extended a React/TypeScript visual planner with deterministic constraint scheduling, dependency DAG validation, an independent allocation checker and reviewed recovery proposals; tested DST, budgets, prerequisites and a bounded exhaustive counterexample.
- Hardened browser state with coordinated Web Lock saves, stale-proposal/worker guards, bounded recovery history and reviewed JSON/ICS portability; expanded the existing suite from 46 to 61 passing behavior/security/integration tests.
- Built reproducible seeded scheduling/recovery benchmarks with environment, source identity, warm-up and latency distributions, then optimized repeated availability validation without removing invariant checks.

These demonstrate algorithmic tradeoffs, concurrency/state reasoning, failure handling and complete UX. They do not claim independent authorship of the original frontend, an optimal solver, improved user productivity, AI generation, real users or production-scale operation.
