# Local browser verification

This harness is developer tooling; it is not part of the production frontend, its routes, or its bundle. It uses only synthetic workloads and never signs in, writes a cloud board, or uploads telemetry. The optional UI observer collects timing/visibility metadata, not plan text or input values.

```sh
pnpm install --frozen-lockfile
npm run build
npm run verify:browser
```

Open `http://127.0.0.1:4191/verification/` and click **Run browser benchmark**. This runs the real module-worker entry and production transport/decoder with fixed synthetic inputs (seed 314). Each size has two warm-ups and five measured scheduling/recovery runs. The visible JSON report includes commit/dirty state, a SHA-256 of the generated verification JS/worker bundle, browser version, hardware concurrency, clock, shape, reply/validation/total timing, cancellation cleanup and bounded test-page frame gaps. Copy the report into a local artifact or a dated evidence file after checking that it contains only synthetic/technical data.

Open `http://127.0.0.1:4191/` for the built planner with **Local performance verification** controls. Open the disclosure, start a profile, perform a synthetic workflow, then stop. The visible report contains bounded frame gaps and Long Tasks API entries when supported. It automatically stops after two minutes, caps frame samples at 7,200 and long-task entries at 500, and never records event text. Use an unused origin/profile or export any existing work before testing. Restore the disposable board afterward.

These are observations on the current device, not INP, a production SLA, a screen-reader test, or a usability study. Browser/automation pauses, visibility, JIT and device load affect measurements. A frame gap and a long-task entry measure different things. Five samples do not establish stable tail latency. The test-page RAF report is separate from the planner profile.

`npm run verify:browser:build` type-checks the TypeScript harness and builds it into ignored `artifacts/browser-check`. CI runs this build without launching a browser/server or asserting timing thresholds. The local server binds only to 127.0.0.1, rejects untrusted Host headers, allows GET/HEAD only, serves an inventory of generated frontend/harness files (never arbitrary source/env paths), and sends the normal security headers plus no-store. Production configuration is unchanged. Press Ctrl+C to stop the local server.

The observed results and exact outstanding human/hosted checks are recorded in dated verification reports. Live OAuth/cloud isolation needs a configured development project and disposable accounts; participant sessions and screen-reader checks remain separate work.
