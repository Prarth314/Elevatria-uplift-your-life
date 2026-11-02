# Full verification run — November 2, 2026

All runnable local checks passed. No product regression was found that required a change to the planner or scheduling algorithm. Added repeatable **local-only browser verification tooling** and its CI type/build check; the production frontend and deployment configuration are unchanged.

## Executed checks

| Check | Observed result |
| --- | --- |
| Frozen offline install | Passed with pnpm 11.25.0 and the current lockfile |
| Frontend/server type checks | Passed |
| Behavior/security/database/integration tests | **61 passed; zero skipped** |
| Production build | Passed; real module scheduling worker emitted |
| Source/history/built-output credential scan | Zero high-confidence findings; seven existing contextual matches (synthetic fixtures/history/public dependency attribution) |
| Current package advisory audit | No known vulnerabilities reported at run time |
| Harness TypeScript/build | Passed; now checked in CI; no browser timing thresholds |
| Local API | Synthetic requests returned 401 AUTH_REQUIRED, 403 ORIGIN_REJECTED, 405 METHOD_NOT_ALLOWED and 503 CLOUD_NOT_CONFIGURED, with no-store responses |
| Local verification server boundaries | App/harness 200; env, source and traversal requests 404; POST 405; raw HTTP untrusted Host 403 |
| Production read-only smoke | Homepage 200 with Elevatria title and CSP; anonymous account API 401 |
| Browser console | No errors in the exercised planner or completed benchmark tab |
| Actual exported artifacts | JSON validated; nine ICS events, nine unique UIDs, exact accepted title/start/end match, zero schedule violations |

Only metadata about configuration presence was inspected. No local Supabase configuration was present and none was added. The tests use synthetic users/SQL roles; no paid service or production-data mutation was performed.

## Browser worker timing

The final [browser report](benchmarks/2026-11-02-browser.json) records clean commit `6a388d8bfac31c7ef8ba22d9525ac779ce8b34eb`, a hash of the generated harness/worker JS, Chrome 156 on Windows, 16 logical CPUs, seed 314, a fixed synthetic clock, two warm-ups and five measured runs. The page stayed visible. Each request created a fresh real browser module worker, used the production worker entry/transport, and passed the production revision/invariant decoder.

| Tasks / goals | Fresh worker + validation median | Main-thread validation median | Fresh recovery + validation median |
| --- | --- | --- | --- |
| 100 / 2 | 21.7 ms | 1.8 ms | 38.1 ms |
| 300 / 3 | 34.3 ms | 5.2 ms | 198.4 ms |
| 1,000 / 5 | 67.5 ms | 9.9 ms | 632.0 ms |

These include startup, transfer, computation and response handling, rather than isolating worker startup alone. Cancellation rejected as AbortError and invoked termination once; the observed abort-to-rejection interval was 1.4 ms. The synthetic test page's RAF gaps had median 16.7 ms and maximum 17.2 ms. This is **not** the planner UI profile, INP, a guaranteed latency or evidence of usefulness. Five samples cannot establish stable tail latency. Earlier exploratory measurements differed under load; the report above is the final clean-commit observation.

The repeated [Node report](benchmarks/2026-11-02-node24.json), from clean application commit `b44b69b`, recorded scheduling medians of 5.21/16.57/55.43 ms and recovery medians of 26.68/243.44/919.38 ms for the three shapes. Node worker_threads and browser module-worker figures have different boundaries/JIT/runtime conditions and are not interchangeable. They are also not a controlled A/B optimization study.

## Actual planner profile and workflow

The [UI profile](benchmarks/2026-11-02-ui.json) covers one roughly 10.8-second automation-assisted synthetic workflow: edit goal date then hours, save through Web Locks, add availability, generate and accept, then complete a task with Space. There were 631 RAF interval samples, a median gap of 16.7 ms and a maximum gap of **200 ms**. The supported Long Tasks API reported **zero entries**. A gap and a long task are different observations; browser rendering, automation and scheduling may affect the gap. Do not omit the 200 ms observation or infer perfect smoothness from the absence of long-task entries. Initial/final visibility was visible. This profile was captured with the working-tree observer subsequently committed in the verification tool; it is not labeled as a clean-commit profile.

Additional built-browser checks confirmed:

- Goal date and weekly-hours edits persisted correctly; no date-reversion regression.
- Keyboard completion updated effort-weighted progress from 13% to 21% and disabled stale Calendar export. Reopening restored the input state.
- Reduced-hours recovery remained a proposal until acceptance; undo restored the previous three-hour board and accepted schedule, including after reload.
- Dialog Tab wrapped within the editor, and Escape returned focus to its opener.
- The tested form controls had accessible names. A limited computed-style scan of visible initial-screen text detected no contrast failures; it excludes complex backgrounds/disabled controls and is not a formal WCAG audit.
- At 390×844, the stable editor's bounds were x=16–374.4 and y=42.2–801.8; its scroll/client widths matched at 342 px. The editor scrolls internally. Desktop and mobile controls were exercised; this is not exhaustive browser/device compatibility testing.
- The sample was restored after using the disposable local board. Downloads contained only the included synthetic project and its test edits.

Screenshots and raw HTTP checks remain in ignored local `artifacts/verification-2026-11-02-*` files. No personal plans were used. Follow [BROWSER_VERIFICATION.md](BROWSER_VERIFICATION.md) to reproduce the browser checks without introducing diagnostics into the public app.

## Still not executable without external/human participation

- **Live Supabase/Google OAuth and two-account cloud verification:** needs the development project, both migrations and user-provided configuration described in CLOUD_SETUP.md. No keys were supplied or provisioned. Local service and actual embedded SQL checks passed, but do not replace hosted gateway/session tests.
- **Screen-reader session and participant usability study:** unperformed. Keyboard/focus/semantic checks do not establish screen-reader compatibility or user satisfaction. The existing USABILITY_STUDY.md is ready to use; no results were invented and no people were contacted.
- **Real calendar-client import/reimport and live sync:** unperformed; verified file validity is not synchronization. Live writes remain deferred.
- **Low-end-device/multi-browser/richer-image profiling and production load:** unperformed. This run closes the single-device browser-measurement gap, not every performance question.
- **Heuristic quality:** the existing exhaustive counterexample still documents a feasible ordering the current deadline-first heuristic misses. No global feasibility, optimality or minimum-disruption guarantee was added.
