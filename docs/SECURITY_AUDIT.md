# Security audit and remediation record

**Reviewed:** October 29, 2026. **Scope:** local repository, reachable frontend and optional API, SQL migrations, dependency lockfile, tracked text history, production output, current image assets, and repository security settings. No public deployment, live cloud project, or paid integration was created.

This is an application source review with regression tests, not an independent penetration test or a production-readiness certification. Findings below distinguish exploitable code paths, conditional cloud risks, dependency advisories, privacy concerns, and defensive improvements.

## Result

The identified code-level issues have been remediated and covered by the checks below. The local planner remains usable without an account, backend, or paid API. Optional account access must remain unconfigured until the live verification steps are complete.

- Dependency audit before remediation: **60 advisory records** (2 critical, 34 high, 20 moderate, 4 low). These are dependency-graph findings, not 60 independently demonstrated application exploits.
- Final package audit: **0 reported vulnerabilities** across 360 dependency entries, as observed on the review date. Future disclosures can change this result.
- Credential-pattern scanning found **no high-confidence matches** in the scanned working tree, supported text blobs in Git history, or generated frontend output. Context matches were synthetic test email addresses and a public dependency-maintainer contact in a historical lockfile.
- Public author/profile attribution is intentional. No actual private credential was identified that required rotation. Do not interpret a bounded pattern scan as proof that every secret or PII format is absent.
- Existing history was preserved. Removed prototype screenshots remain recoverable in history; no private location/contact/author indicators were found in the reviewed metadata fields. History was not silently rewritten.

## Findings and fixes

Severity describes the original exposure and relevant preconditions, not a claim of a live compromise.

| ID / priority | Finding and impact | Remediation and evidence |
| --- | --- | --- |
| SEC-01 · High | Vulnerable direct/transitive packages, including critical seroval advisories and development/build tool advisories. Reachability varies. | Upgrade Vite/React plugin/router/PostCSS/sharp and patched transitive ranges; remove unused editor/3D packages. Frozen install, production build and package audit pass. Dependency entries reduced from 522 to 360. |
| SEC-02 · High, conditional account mode | Local persistence retry could write a private in-memory account board into the shared demo store. | Central demo-write guard rejects account ownership on retry/reset/save paths. Account storage events are isolated. Regression test proves the private board never replaces the demo value. |
| SEC-03 · High, configuration-dependent | Legacy environment injection and unguarded public configuration could publish provider secrets or send credentials to a wrong endpoint. | Remove blanket environment injection and legacy env-file copying. Reject recognizable privileged values in all VITE_ variables; validate public key type and canonical service origins. Server credentials remain server-only; built output is scanned. |
| SEC-04 · High, retired prototype | Browser password/auth-table and membership checks provided no trustworthy authorization. | Retire password comparison/persistence and prototype session/tier mutation. Startup removes retired auth/key/session entries without reading their values. Old admin/member screens are not active routes. Server Auth verification is the sole optional cloud identity boundary. |
| SEC-05 · High, imported/remote data | Loose nested validation and large histories could retain hidden fields, malformed graphs, or expensive input. | Strict plain-object field allowlists, bounded text/IDs/dates, aggregate task/milestone/image/history limits, cycle checks, and version validation. Malicious-field, prototype-key, graph and size regressions pass. |
| SEC-06 · Medium, image input | A small compressed file could decode to excessive pixels; imported images could carry metadata. | Check actual PNG/JPEG/WebP signatures, MIME and dimension headers before decoding. Limit each side to 4096px / 12MP, input to 1MB, output to 1600px; re-encode uploads and UI imports/cloud uploads as static WebP. Sequential processing avoids concurrent bitmap spikes. Header parsing is not a general-purpose image malware scanner. |
| SEC-07 · High, conditional cloud mode | Slow/oversized bodies or provider replies, unbounded traffic and provider redirects could exhaust resources or forward credentials. | Authenticate before application body parsing, enforce JSON/encoding/byte limits, request/provider deadlines, bounded upstream streams, redirect rejection, sanitized errors and no-store responses. API process throttle plus shared database limits; regressions cover bounds/origin/errors. Platform body parsing and traffic behavior still need hosted verification. |
| SEC-08 · High, conditional cloud mode | Cross-account asynchronous responses and late saves could restore stale views or overwrite newer local edits. | Account epoch guards, auth-event sequencing, memory-only documents, separate keyed editor state, single-operation guard, sign-out cleanup and expired-session recovery. Save responses replace the view only when no newer edit exists. Helpers are unit-tested; real OAuth transitions remain unverified. |
| SEC-09 · Medium, conditional cloud mode | Deleting/recreating a board could reuse a revision, allowing a stale write/delete to match a new board (ABA problem). | Migration 002 uses a monotonic non-cycling sequence; stale revisions are rejected even after recreation. Embedded PostgreSQL test executes the sequence/recreation case. |
| SEC-10 · Medium, conditional cloud mode | Direct authenticated table reads bypassed API validation, caching policy and account operation limits. | Migration 002 revokes browser table access and workspace RPC execution. All document reads/writes/deletes use service-only RPCs with a verified owner and atomic per-account limits. PostgreSQL tests exercise denied roles and independent accounts. |
| SEC-11 · Medium, defensive hardening | Missing delivery policies and a dynamic CSS HTML sink increased consequences of injection. | Remove dangerous HTML rendering in chart styles; validate CSS IDs/keys/colors. Add production CSP without unsafe script execution, anti-framing, nosniff, referrer/permissions/HSTS headers. Build adds an exact configured-project connect policy, or self-only when unconfigured. Inline styles remain permitted for React/component styling. |
| SEC-12 · Low, privacy | External font loading and unused historical screenshots increased unnecessary data exposure/surface. | Self-host fonts with licenses. Remove 16 unused prototype screenshots from the current source tree. Separately inspect EXIF/XMP context without printing values; retain required artwork and application preview. Browser uploads are re-encoded. |
| SEC-13 · Medium, performance/availability | Main-thread scheduling, repeated scans and unbounded caches could make large valid boards unresponsive. | Cancellable scheduling worker with a five-second deadline, bounded input/output, grouped lookups, adjacency construction, memoized fingerprints and bounded formatter/image caches. Reproducible synthetic benchmark is available. |
| SEC-14 · Low, integrity/UX | An invalid edit or failed schedule application could close the editor or announce persistence incorrectly. | Keep rejected task/goal/item/milestone edits open, surface errors, preserve the previous workspace, and distinguish in-memory application from persistence. Browser cycle rejection and completion/reload checks pass. A duplicate React key introduced during remediation was found and fixed in browser testing. |
| SEC-15 · Medium, supply chain/operations | Moving CI action tags, accidental legacy deployment scripts and no maintained reporting path made future regressions easier. | Pin CI actions to immutable commits, disable checkout credential persistence, scan history/output and audit dependencies in CI. Disable legacy shell deployment entry points with an explicit exit. Add SECURITY.md; verify GitHub secret scanning, push protection, vulnerability alerts, automated security-fix PRs and private reporting. No paid security product enabled. |

## Trust boundaries

1. **Local demo:** one unencrypted workspace per browser origin; no authentication or membership authorization is implied. Other same-origin scripts and people using the browser profile can access local data. Export files contain board contents and should be handled as user data.
2. **Optional identity:** Supabase GitHub OAuth with PKCE, SDK sessionStorage and server verification through Auth. Non-GitHub/anonymous identities are rejected. The server ignores browser-supplied owner IDs. SessionStorage is JavaScript-readable; CSP and validated rendering reduce risk but do not provide HttpOnly isolation.
3. **API:** same-origin bearer requests; owner derived from verified identity. No cookies are used for API authorization. Origin checks are supplementary; possession of a valid token still grants its account access. No provider error/token is reflected in API output.
4. **Database:** one JSON document per owner. Browser roles are denied document access after both migrations; service credentials can bypass RLS and must never be exposed. Atomic revisions prevent blind overwrites. Database rate limits are shared; the process/IP throttle is supplementary and can be evicted or reset.
5. **Inactive reference code:** original Motoko/Calendar/admin modules are not active product services. Legacy shell entry points stop immediately. The Motoko backend was not compiled, provisioned, or certified by this audit; do not expose it without a dedicated review.

## Enforced limits

| Resource | Bound |
| --- | --- |
| JSON backup/local serialized board | 8 MB |
| Cloud document / application request | 1 MB / 1.1 MB |
| Tasks / milestones across a board | 1000 / 300 |
| One schedule / all retained sessions | 4096 / 16384 |
| Accepted-history snapshots | 10 previous versions |
| Image input / dimensions | 1 MB; 4096px per side; 12MP |
| Availability / fixed commitments | 28 windows / 100 commitments |
| Planning horizon / session | 56 days / 120 minutes |
| Background computation | 5 seconds, cancellable |
| API body / upstream fetch / browser request | 8s / 8s / 12s deadlines |
| Shared database operations | 60 per account per minute |
| Supplementary process throttle | 120 requests per observed IP per minute, at most 2048 buckets |

A valid large local board may exceed the smaller cloud cap. The API rejects it visibly; it is not silently truncated. A very large schedule/history can also hit a bound and require shorter horizons or less history.

## Checks performed

See [VERIFICATION.md](VERIFICATION.md) for the current automated and browser record. The suite includes 35 tests covering planning invariants, randomized DAGs, imports, Calendar escaping/stable identity, PostgreSQL role permissions/rate limits/revisions, service ownership, input/resource limits, secret/config guards, async state helpers and demo/account separation.

Commands:

```sh
pnpm install --frozen-lockfile
npm run typecheck
npm test
npm run build
npm run audit -- --history --dist
pnpm audit --audit-level low
npm run benchmark
git diff --check
```

Synthetic scheduling benchmark on Node 24.15 / Windows x64, 56-day UTC horizon, three runs per size: median approximately 8ms for 100 tasks, 19ms for 300, and 34ms for 1000. The largest fixture leaves work unscheduled because availability is finite. These measurements are not device-independent latency guarantees or an optimality proof. Browser imports, validation, rendering and storage writes still run on the main thread within explicit bounds; virtualization/indexed storage can be evaluated if measured real workloads require it.

## Remaining plan before enabling hosted account access

| Priority | Required action | Completion criterion |
| --- | --- | --- |
| P0 · Configuration | Create/select a free Supabase development project; apply migrations 001 then 002; configure only intended GitHub OAuth and exact redirects; put secrets only in server env. | Migration permissions, public bundle and callback settings reviewed on the actual project. No paid tier required. |
| P0 · Live identity/data checks | Use two real test accounts; test expiry/refresh/sign-out/switch, simultaneous writes/deletion/recreation and guessed ownership fields. | No account leakage; visible 401/409 recovery; real gateway uses the intended owner/permissions. Embedded tests alone are insufficient. |
| P0 · Hosting controls | Separately authorize a Vercel preview, verify Node/runtime API routing, headers, CSP, request-size handling, server-only env and free-plan quotas/traffic controls. | Hosted smoke/security checks pass. No public deployment has been authorized for this work. |
| P1 · Operations | Define retention, account deletion and backup/restore procedures; decide who receives private vulnerability reports; inspect security alerts. | Tested deletion/recovery policy and practical free-service usage limits. Do not retain sensitive user boards during evaluation. |
| P1 · Further review | Re-run dependency and source/history/output scans at each release; review service configuration and original inactive modules before activation. | CI gates pass; real credentials, if ever found later, are revoked/rotated before history cleanup discussions. |
| P2 · Product extensions | Before AI or Calendar sync, add bounded server integrations, validated proposals, per-user budgets, idempotency/reconciliation and partial-failure tests. | No browser provider secrets; duplicate/concurrent remote exports cannot create extra events. Current ICS download is not Google sync. |

No unlimited free-service guarantee, global denial-of-service defense, encrypted local store, account-wide instant token revocation, live penetration test, or production-readiness claim is made.
