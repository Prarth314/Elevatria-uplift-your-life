# Verification record

October 29, 2026. Tests ran on Windows with Node 24.15.0 and pnpm 11.25.0. No public deployment was performed.

## Automated checks

- `pnpm install --frozen-lockfile`: passed after making dependency build-script policy explicit.
- `npm run typecheck`: passed for the full frontend, including retained prototype modules. Three original Calendar type errors were repaired.
- `npm test`: seven passing behavior groups covering structured plan generation, schema rejection, unique IDs, weighted complete/reopen progress, deadline capacity, weekly effort bounds/order, persistence round-trip, and corrupt/unavailable/quota storage failures.
- `npm run build`: production frontend built successfully. The original Vite bundle also built before edits. Bundling continues to report stale Browserslist/baseline-browser-mapping metadata; this is a warning, not a failed check.
- `npm run audit`: bounded credential-pattern scan prints categories and locations only. No real embedded provider-key/private-key matches found. Original assets were reviewed visually.
- `git diff --check`: passed.

GitHub Actions runs the same typecheck, tests, and build on pushes and pull requests. Local passing results are independent of remote CI status.

## Browser verification

Used the local Vite app in the in-app browser. Desktop viewport: **1440 × 1000**. Mobile viewport: **390 × 844**. Neither layout had horizontal overflow.

Verified through actual controls:

1. Create a goal with outcome, deadline, weekly hours, constraints, and color; edit the deadline and confirm the saved card reflects it.
2. Generate a structured plan; edit a task title and duration; complete it and reload to verify saved progress.
3. Create and edit inspiration, then reload. Reject an image larger than 1 MB; accept a smaller PNG; verify its image survives reload.
4. Add a milestone and a task. Complete a checkbox with Space. Remove the test milestone through the confirmation dialog.
5. Open plan regeneration and cancel it; existing edits remain intact.
6. Open an editor using a keyboard-accessible button, verify initial field focus, close using Escape, and verify focus returns to the opener.
7. Open weekly focus and verify the visible tasks fit the edited two-hour budget and preserve plan order.
8. Start fresh to verify the empty-board flow; reload the sample using the mobile footer.
9. Export board JSON using the actual download control.
10. Change a task in a second tab. The original tab displays a conflict warning with separate working/saved export choices; reload recovers the saved version. Restored sample progress after testing.

The final browser error-log query returned no error entries. Screenshots are kept locally under ignored `artifacts/desktop-planner.png` and `artifacts/mobile-planner.png`; browser test data was reset to the sample.

## Verification limits

- Storage schema/quota/unavailability are unit-tested with injected storage failures. Browser settings were not changed to force real quota exhaustion or disable storage.
- No authenticated users exist, so no real user-isolation guarantee or authorization test is claimed.
- No AI provider, Motoko compiler/runtime, OAuth consent, Google Calendar write, webhook, dependency-aware schedule, or replan is enabled or end-to-end tested.
- Accessibility checks cover keyboard use, focus, semantics, responsive visual inspection, and reduced-motion CSS. No screen-reader session or formal WCAG audit was performed.
- Static frontend output is provided for Vercel configuration; hosted routing and deployment are unverified.
