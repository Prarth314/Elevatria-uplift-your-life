# Architecture decision: isolate the local planning workflow first

## Implementation update — October 29, 2026

The original decisions below are retained as design context. Scheduling, backup restoration and optional account storage are now implemented:

- The active React/Vite frontend retains a central visual board. Domain validation, templates, dependency handling, image processing, persistence and scheduling live in separate planner modules.
- A bounded Web Worker runs a deterministic earliest-deadline scheduling heuristic; an independent validator checks placements. Global work windows, fixed commitments, timezone/DST handling, per-goal weekly budgets, deadlines, splitting and breaks constrain proposals. Acceptance and replanning remain explicit user actions; no optimality or minimal-disruption claim is made.
- The optional same-origin Node/Vercel API verifies a Supabase GitHub-backed identity, derives ownership, and validates every document. One JSONB document per owner permits atomic optimistic replacement while preserving the existing versioned backup format. It trades normalized task queries/asset efficiency for a small, testable initial storage boundary.
- Both PostgreSQL migrations are required. Migration 002 removes direct browser table access, adds shared per-account operation limits and non-reused revisions. Service credentials are server-only. Local demo documents and in-memory account documents have separate persistence paths.
- No Supabase project has been connected or verified live. No server AI or remote Google Calendar synchronization is enabled. Current Calendar output is an escaped ICS download with stable occurrence identities; calendar-client behavior remains outside its guarantee.
- The retained Motoko source is inactive; legacy shell deployment entry points are disabled. This preserves the experiment without making it an unverified runtime requirement.

See [cloud setup](CLOUD_SETUP.md), [security findings](SECURITY_AUDIT.md), and [current verification](VERIFICATION.md). The contracts below describe the original targets; task-level APIs, AI and durable remote Calendar operations are still future work.

## Original decision

Keep the React/Vite application and existing component primitives. Introduce a planner domain and storage boundary. Keep the original Motoko source and generated bindings, but do not initialize Internet Identity or create actors for the local demo. The existing backend has no goal model to preserve, so Milestone 1 does not need a backend migration.

Planning and persistence are independent of React. `generatePlan` creates a transparent template; it does not call an AI provider. `validWorkspace` validates persisted unknown input, enforces limits, checks dates, unique IDs and item/goal links, and rejects executable image formats/remote image URLs. Storage failures remain visible; invalid stored data is not silently replaced. Cross-tab changes block automatic overwrites until reviewed/reloaded. JSON exports can preserve both the current working board and the original saved data in an error state.

Task progress uses estimated effort, not just task count. This avoids a five-minute task carrying the same weight as a two-hour task. Weekly focus keeps current plan order and stops at the first incomplete task that does not fit the remaining budget. It is deliberately not presented as a schedule or dependency solver.

## Motoko tradeoff

Retaining Motoko would offer principal-based identity and persistent actor state, and the Calendar metadata is already namespaced by caller. It would also require: a reproducible compiler/runtime, replacing or validating platform-specific blob primitives, rejecting anonymous principals, designing all goal/task APIs, testing principal isolation, and handling HTTP outcalls/provider secrets/cycles. The existing export alone does not provide those features. The backend could not be compiled or deployed with the installed tools, so its runtime behavior is not claimed as verified.

For a Vercel-compatible portfolio application, the recommended next step is a conventional authenticated API plus a relational store. A server can enforce record ownership, validate AI output, hold provider credentials, and perform idempotent Calendar operations. That gives a more direct path to the requested workflow and testable security boundaries. Costs and hosting/provider choices remain unconfigured; no accounts or paid services have been added. This recommendation does not delete the retained ICP experiment.

## Milestone 2 contract

- The server derives user identity from a verified session, never a browser-supplied user ID or tier.
- Every goal, milestone, task, and inspiration operation checks ownership. Integration tests prove two users cannot read or mutate each other's data, including guessed IDs and nested resources.
- A repository adapter replaces browser persistence without moving model logic into components. Use schema versioning and optimistic concurrency to prevent lost updates.
- Server AI requests accept bounded goal context and produce a validated plan schema. Reject duplicate IDs, invalid durations, impossible references, unexpected fields, and malformed responses. Review proposed plans before replacement.
- The UI distinguishes network loading, provider failure, retry, empty response, and explicitly selected template-demo fallback. Secrets never enter a `VITE_` variable or browser storage.

## Milestone 3 contract

- Model availability windows with an explicit time zone, task duration, earliest/latest dates, and dependency edges. Validate cycles before scheduling. Account for daylight-saving transitions and fixed events.
- Scheduling returns slots plus unscheduled work/reasons; it must not quietly overbook or ignore deadlines.
- Replanning creates a proposed diff and preserves completed work. User approval is required before changing the accepted schedule.
- Calendar export uses stable identity scoped to user, plan, task, and occurrence; reconcile with the remote event before retrying. Persist operations and remote IDs so an insert-success/persistence-failure cannot create duplicates on retry.
- Test duration/window bounds, deadline/cycle handling, ownership isolation, duplicate/concurrent export attempts, and partial failure recovery before enabling integrations.
