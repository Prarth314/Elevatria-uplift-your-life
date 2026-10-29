# Codebase assessment

Inspected October 29, 2026. The project root is the nested `elevatria-main` directory, not its parent. No applicable AGENTS.md files or pre-existing Git repository were found. A source-preservation commit was created before feature work. No previous contributor history existed to migrate.

## Baseline evidence

| Area | Findings from implementation |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 5, Tailwind, TanStack Router/Query, Radix UI, Lucide, Motion. A 2,200+ line dashboard mixes persistence, API access, and UI. Many generated component/dependency packages are unused. |
| Login and tiers | Member credential table in localStorage; active user/tier in sessionStorage. Tier derived from access-code suffix with a permissive legacy fallback. Admin mutates the same browser table. This is prototype state, not authorization. |
| Vision board | Nine text/image cells with localStorage CRUD and image data URLs. Source handlers do save edits. Asset references were broken by the split public directory in the original Vite setup. |
| Coach and roadmap | Actual browser fetches to OpenAI, driven by a provider key saved in localStorage. Roadmap is free text in chat; the latest roadmap exists only in component state. No structured milestone/task persistence, task completion model, availability constraints, or replanning engine. Direct provider calls and key entry/storage were removed before publishing the active changes. |
| Themes | Browser-stored theme/custom color with DOM CSS updates. These are implemented local behaviors, not server preferences. The new workspace preserves the botanical direction and offers goal-card colors; original theme source remains available for later adaptation. |
| Gratitude | Entries stored only in React component state, lost on reload. |
| Webhooks | Sends arbitrary board/roadmap payloads to a user-entered URL. Success toast does not check HTTP response status. No service-specific Notion/Slack integration or reliable sync protocol. Inactive in the new app. |
| Google Calendar | Real OAuth/Calendar insertion code, encrypted tab token storage with an in-memory key, retry logic, and canister event-link writes. No configured client ID or usable backend config in the export. Event-link read method exists but is never checked before insertion. Retrying after insertion or canister failure can duplicate events. Roadmap day IDs collide between plans, event times are generated from the current time, not availability. Not end-to-end verified or enabled. |
| Backend | Motoko actor stores Calendar-linked booleans per principal and task/event mappings namespaced by principal. Blob-storage mixin uses Caffeine-specific primitives and cashier/gateway configuration. No goal, task, user-profile, scheduling, or AI implementation. `triggerDapps` is an empty function. Anonymous callers are not rejected. |
| Deployment | ICP CLI YAML, Linux Bash/Docker flow, hardcoded Caffeine compiler paths/version, and mixed Motoko base/core packages. Exported env config has undefined placeholders. No local ICP/Motoko compiler is available. Static frontend can run independently. |

## Original verification

- Vite production bundling passed before feature edits.
- Baseline type check failed with three errors: `GoogleCalendarService.ts` typed-array/BufferSource mismatch and two possibly-null token uses. These were repaired separately from planner behavior.
- No test files or test script were present.
- First install was blocked by sandbox store permissions; authorized install completed dependency fetching but pnpm 11 rejected unspecified dependency build scripts. Explicit build policy now permits only esbuild; the final frozen install passes.
- The original pnpm build invokes Unix `cp`; root scripts now use Node and work on Windows.
- Source credential-pattern scan found no embedded real provider keys, private keys, or email-address matches. Env/config files contain placeholders. Bundled screenshot assets were visually reviewed; they show prototype UI, sample prompts, and a Caffeine app URL, without visible authentication tokens or direct personal identifiers. Files excluded from Git include dependencies, compiled assets/Wasm, env files, logs, and caches. This pattern scan is a bounded review, not a guarantee against every possible secret format.

## Priority order

1. **Implemented:** one local goal → structured editable plan → completion/progress loop, central vision board, sample data, and responsive editing.
2. **Next:** real identity and ownership-checked persistence, then server AI structured generation. Preserve the usable local demo during integration. Do not revive prototype tier checks as permissions.
3. **Later:** tested scheduling constraints and dependencies, reviewable replanning, then idempotent Calendar export and reconciliation.

No external AI, OAuth, Calendar, webhook, Motoko deployment, paid integration, or public hosting has been activated.
