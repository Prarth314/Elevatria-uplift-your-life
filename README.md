# Elevatria — Uplift Your Life

A visual goal planner that connects the future you imagine to the next step you can take. Started as a frontend learning project exported from [Caffeine](https://caffeine.ai/), now being developed into a focused software engineering portfolio project.

**Current release: Milestone 1, local demo.** No signup, provider key, backend, or paid service is required. This is a working browser-persisted prototype, not a production service or an AI-powered planner.

## Run locally

From the actual project root, `elevatria-main`:

```sh
node --version                    # Node.js 24 or newer
npm install --global pnpm@11.25.0 # or use your existing pinned pnpm installation
pnpm install --frozen-lockfile
npm run dev
```

Open the Local URL printed by Vite (normally `http://127.0.0.1:5173`). If the port is occupied, use `npm run dev -- --port 5174`. On Windows, the root scripts use Node rather than Unix `cp` or Bash. The dependency lockfile is committed; the workspace explicitly allows esbuild's installation script and disables optional Biome/sharp scripts.

```sh
npm run typecheck
npm test
npm run build
npm run preview                  # serves the production build locally
npm run audit                    # source credential-pattern scan; no values printed
```

The demo needs no `.env`. `.env.example` documents the optional public client ID for the retained Calendar prototype and a future server-only AI key. **Never add provider secrets to Vite variables or browser storage.**

## Try the main workflow

1. Explore the sample **Build an AI study assistant** goal: three milestones, nine realistic tasks, two completed tasks, and connected inspiration.
2. Choose **New goal**. Describe success, pick a target date, add weekly available hours and constraints, and select a board color.
3. Choose **Generate starter plan**. The local template creates three milestones and nine tasks. Customize every title and time estimate; add or remove milestones and tasks as needed.
4. Add notes or an image to the vision board. Supported images are PNG, JPEG, and WebP under 1 MB. Connect inspiration to a goal, or keep it independent.
5. Complete tasks using the checkboxes. Progress reflects completed estimated minutes divided by total estimated minutes. Reopen a task to update progress.
6. Open **Weekly focus** for the next tasks that fit your weekly time budget. This is an ordered focus list, not a calendar or dependency-aware schedule.
7. Refresh to verify persistence. Export the board as JSON for a backup. **Export is currently one-way; there is no import UI.** Load the sample or start fresh using the sidebar or mobile footer. Destructive changes require review.

Goal constraints are recorded and shown beside the plan. The generic local generator does **not** interpret constraints or estimate domain-specific work. Deadlines and availability inform a rough capacity warning, not exact work sessions. The warning uses a uniform daily share of your weekly hours, including the target day.

## Implemented

- Consistent Elevatria branding and responsive vision-board-first workspace.
- Goal, inspiration, milestone, and task editing with validated local persistence.
- Image pins, goal-linked notes, editable estimates, completion, and effort-weighted progress.
- Transparent offline starter generation and weekly effort-budget suggestions.
- Ready-to-explore sample project and an empty-board flow.
- Storage read, schema, quota, and cross-tab conflict handling; retry and separate exports of working/saved data where needed.
- Keyboard-operable controls, Escape-to-close dialogs, focus restoration, focus indicators, native checkboxes, and reduced-motion styling.
- Behavior tests, TypeScript checks, cross-platform build scripts, and a GitHub Actions workflow.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/frontend/src/pages/Planner.tsx` | Workspace composition and user actions |
| `src/frontend/src/planner/Editors.tsx` | Accessible Radix-based editing and confirmation dialogs |
| `src/frontend/src/planner/model.ts` | Versioned domain types, runtime validation, date and progress helpers |
| `src/frontend/src/planner/planning.ts` | Pure local plan generation, capacity estimate, weekly focus selection |
| `src/frontend/src/planner/persistence.ts` | Injected storage port, validated loading/saving and visible errors |
| `src/frontend/src/planner/sample.ts` | Fresh sample project with generated IDs and relative dates |
| `tests/planner.test.ts` | Domain and persistence behavior tests using Node's test runner |
| `src/backend/` | Retained Motoko/Internet Computer prototype, inactive in this demo |

React 19, TypeScript, Vite, Tailwind, TanStack Router, Lucide, and the existing Radix component primitives remain in use. Routes `/` and `/dashboard` open the planner. The original `Landing.tsx`, `Dashboard.tsx`, `Admin.tsx`, themes, Calendar modules, generated bindings, and Caffeine metadata are retained as source for reference. The old member/admin screens are not routed into the app. Unused original dependencies remain installed for incremental migration, but inactive prototype modules are excluded from the frontend entry bundle.

The active browser store is `elevatria.workspace.v1`. It is a single shared demo workspace on this browser origin. It has **no authentication, user isolation, authorization, cloud persistence, encryption, or cross-device sync**. Do not use it for sensitive information. Legacy board/chat keys are left untouched. The former provider-key localStorage entry is removed on startup without reading its value.

See [the codebase assessment](docs/ASSESSMENT.md), [architecture decision](docs/ARCHITECTURE.md), and [verification record](docs/VERIFICATION.md).

## Frontend hosting and backend requirements

The frontend builds to `src/frontend/dist`. A `vercel.json` is provided for a future Vercel project rooted at this directory, including a `/dashboard` SPA rewrite. Other static hosts need the same route fallback. No deployment has been created or verified. Fonts currently load Inter and Playfair Display from Google Fonts, with system/Georgia fallbacks; the UI works without those network requests.

The old `build.sh`, `deploy.sh`, `Dockerfile`, `icp.yaml`, and canister definitions describe the original ICP export. They require separate ICP/Motoko tooling and Caffeine-specific compiler/storage support. They are **not** the frontend setup path and were not executed. The original backend has no goals/tasks API, and is not suitable as the active persistence layer without further development.

## Next milestones

**Milestone 2:** authenticated server sessions, persistent ownership-checked storage, server-only AI access with validated structured responses, and predictable failure/retry behavior. Add authorization isolation tests before enabling real users. Keep the local template as a labeled demo fallback.

**Milestone 3:** duration- and availability-aware scheduling with dependencies and deadlines; a user-reviewed replan diff; Calendar export/sync using deterministic event IDs or equivalent idempotency, durable mappings, and visible reconciliation after partial failure. The retained Calendar prototype is inactive and does not meet those guarantees.

## Attribution

Original source exported from [Caffeine](https://caffeine.ai/). Existing generated scaffolding, original screenshots and botanical art remain in the repository; reference screenshots are not copied into the active production frontend. The current board landscape is drawn in CSS and uses Lucide icons. The original MIT license is preserved in [LICENSE](LICENSE).
