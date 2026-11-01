# Verification record

## Current engineering milestone — November 1, 2026

The current local milestone has **61 passing tests**, including Web Lock coordination, worker lifecycle/entry integration, full-scheduler DST checks, independent ICS parsing and an exhaustive heuristic counterexample. Frontend/server type checks, production build, credential scan and dependency audit pass locally. See [ENGINEERING_EVIDENCE.md](ENGINEERING_EVIDENCE.md) for the capability/evidence matrix, current browser/artifact results and remaining external/human checks, [PLANNING_MODEL.md](PLANNING_MODEL.md) for exact semantics, and [BENCHMARKS.md](BENCHMARKS.md) for measurement boundaries. Older counts and public-verification limitations below are historical; their chronology is preserved rather than relabeled as current evidence.

## Hosted verification — October 30, 2026

The connected Hobby project successfully deployed the corrected application at [elevatria-website.vercel.app](https://elevatria-website.vercel.app). The code-fix deployment of a9f831f reached Ready with clean build diagnostics, and its GitHub Actions run passed all 38 tests, frontend/server type checks, production build and audit gates.

Verified against the production domain:

- / and /dashboard return 200 with the Elevatria document title and the intended CSP, anti-framing, nosniff and referrer policies.
- /api/workspace returns structured JSON: 401 AUTH_REQUIRED without a token, 503 CLOUD_NOT_CONFIGURED for a syntactically valid synthetic token, and 403 ORIGIN_REJECTED for an untrusted origin. Responses are no-store; no authenticated provider call was needed.
- Browser goal edits survive reload. Keyboard task completion updates weighted progress. The background worker generates a proposal under production CSP, and accepted sessions survive reload. Synthetic edits were restored to the sample.
- The hosted browser console error query returned no entries.

Supabase remains unconfigured. OAuth, real cloud-user isolation, provider storage and Calendar sync are not claimed as verified. No paid integration or plan upgrade was enabled.

## Original security verification — October 29, 2026

The following record is historical. The hosted follow-up above supersedes its public routing/function verification limits; its live OAuth/account limitations still apply.

**October 29, 2026.** Windows x64, Node 24.15.0, pnpm 11.25.0. Current local checks include the scheduling/account foundation and subsequent security remediation. No public deployment or live Supabase project was used.

## Automated checks

| Check | Result and scope |
| --- | --- |
| Frozen dependency installation | Passed with the pinned package manager and lockfile. |
| TypeScript | Full frontend and server checks passed, including retained prototype modules. The original three Calendar type errors were fixed earlier. |
| Behavior tests | **35 passed**, none skipped. Domain, scheduler, portability, service, SQL and security tests. |
| Production build | Vite 8 frontend builds successfully, including a separate schedule worker, lazy Supabase SDK chunk and self-hosted fonts. |
| Package audit | **0 reported vulnerabilities** at the review time. Before remediation the dependency scan reported 60 advisory records, not 60 demonstrated reachable exploits. |
| Source/history/output scan | No high-confidence credential matches; context email matches were synthetic tests and a historical public dependency contact. Scans emit metadata only. |
| Source hygiene | git diff --check passed; env/dependencies/output/cache/logs/credential file patterns remain ignored. |
| HTTP smoke checks | Current local API returns 401 unauthenticated, 405 unsupported method, 403 wrong origin, and 503 unconfigured cloud; all include no-store responses. |
| Development file access | Actual HTTP requests for root env-example and server source paths returned 403; the intended frontend entry returned 200. |
| Production delivery | Local preview returned CSP, DENY framing, nosniff, no-referrer and permissions headers. Built HTML adds self-only connect policy when cloud is unconfigured. Vercel delivery itself remains unverified. |

CI runs installation, type checks, tests, build, history/output credential scan and package audit on pushes/PRs. Action revisions are immutable and checkout credentials are not persisted. The latest pushed head's remote conclusion is checked separately; local success alone is not a remote CI claim.

### Test details

- **Planner:** valid templates/sample, unique IDs, date/effort/shape rejection, weighted completion/reopen, rough capacity and ordered weekly focus, storage round-trip and failure preservation.
- **Scheduler:** deterministic placements, dependencies, competing goals, splitting/breaks, fixed commitments, budget/deadline bounds, unscheduled reasons, cycles, timezone/DST gap/fold handling, manipulated schedule rejection and randomized DAG fixtures.
- **Portability:** legacy backup compatibility, reviewed format validation, accepted/history persistence, ICS newline injection escaping, UTF-8 folding and stable task-occurrence UIDs.
- **Cloud services:** derived ownership, two distinct synthetic users, unknown owner fields rejected, stale write/delete rejection, size caps, provider adapter headers/no redirects, malformed replies and rate-limit errors.
- **PostgreSQL:** PGlite executes the actual SQL migrations against a synthetic auth schema. The migration-001 test records its original owner-read RLS behavior; the combined 001+002 test verifies the current stricter permissions, non-reused revisions and account rate limits. These tests do not validate hosted Supabase configuration.
- **Security:** strict nested/aggregate data bounds, image signature/pixel limits, service-origin/key guards, malformed history, stale account epochs/save races, chart injection rejection, request/provider bounds, safe HTTP errors, metadata-only credential reporting and account-to-demo write prevention.

## Browser verification

The production build was exercised in the in-app browser at **1440 × 1000** and **390 × 844** viewport settings. The smaller content width excludes the scrollbar. No horizontal overflow was observed.

Checks performed through actual controls during remediation:

1. Add a real work window, save it, run the background worker, inspect a nine-session proposal with explicit unplaced work, and accept it. Only one schedule panel remains after saves.
2. Download the accepted ICS file; inspect nine events and nine unique UIDs. This does not verify importing it into Google Calendar.
3. Add a goal containing HTML-like markup. It renders as literal text, creates no corresponding image element, and opens no script dialog. Rename it to a synthetic review goal, generate its starter plan, and inspect editable tasks.
4. Attempt a cyclic prerequisite edit. The editor stays open, shows an error, and preserves the original board.
5. Close the editor with Escape and verify focus returns to the opener. Complete a task with Space, reload, and observe persisted weighted progress.
6. Upload a bounded PNG through the image picker and save an inspiration card using the processing path. Earlier core-flow checks also verified file-size rejection, image reload, goal date editing, milestones, empty states and cross-tab conflict recovery.
7. Import a valid synthetic JSON backup, review goal/task/item counts, and explicitly replace the temporary review board with the sample. Import a backup with an unknown field; visible validation rejects it and retains the sample.
8. Inspect mobile board/editor/schedule controls and the restored sample, with no horizontal overflow. Confirm account storage is clearly unavailable when unconfigured.

Scenario comparison, accepted-history persistence and stale-proposal blocking were exercised during the earlier scheduling milestone. The automated suite continues to cover these domain invariants. Keyboard/focus checks and responsive inspection do not constitute a formal WCAG audit or a screen-reader session.

A fresh final-build tab is used for the final console-error query, so earlier development errors are not mistaken for current behavior. Browser evidence is saved locally under ignored artifacts/security-verified-desktop.png and artifacts/security-verified-mobile.png. Temporary browser test data was restored to the included sample.

## Performance evidence

npm run benchmark generates valid synthetic DAGs at 100, 300 and 1000 tasks, checks scheduling invariants and records three runs per size. An observed 56-day UTC run had medians around 8ms, 19ms and 34ms respectively; the largest case left work unplaced because availability is finite. Re-run on the target device rather than treating these as guaranteed latencies. Worker startup/clone/UI costs are not included in the Node measurements.

Main-thread imports, schema validation, image preprocessing and synchronous localStorage remain bounded but can still be noticeable on slow devices. Larger real workloads should be measured before adding virtualization, indexed storage or server jobs. No load test of an external service or global denial-of-service protection is claimed.

## Remaining verification limits

- No real OAuth callback, token refresh/expiry, live account switching or hosted two-account session was tested. Async state guards are tested as extracted helpers; live behavior still needs the setup in CLOUD_SETUP.md.
- Embedded SQL executes actual migrations with synthetic roles; a live provider's gateway, grants, project settings and parallel-request behavior remain to verify.
- Storage quota/unavailability are tested with injected failures; browser settings were not changed to force real exhaustion.
- No public Vercel route/function test, external AI request, remote Calendar write, Motoko build/deployment, account deletion or operational backup-recovery process is claimed.
- Credential patterns and metadata review do not establish absence of every secret, PII format or image content issue. Intentional public author attribution remains.

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the complete finding/remediation list and prioritized operational plan.
