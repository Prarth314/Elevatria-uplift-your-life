# Architecture decision: isolate the local planning workflow first

## Current decision

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
