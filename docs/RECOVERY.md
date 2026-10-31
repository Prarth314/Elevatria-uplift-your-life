# My week changed

Recovery is a user-reviewed adjustment to an accepted schedule. It works locally without AI, an account or a paid API. It does not silently complete tasks or modify Google Calendar.

## Review the workflow

1. Create/edit goals and tasks. Set work windows and accept an initial schedule.
2. Open **Schedule & replan → My week changed**.
3. Choose missed work/restart, changed availability, fewer weekly hours, a new total task estimate, or an extended deadline.
4. For changed availability, edit windows/commitments above without saving; recovery includes the draft availability in its proposal.
5. Optionally protect existing task sessions. Protection fixes **all** existing sessions of that task for this recovery only. Completed, partly missed or re-estimated task allocations cannot be protected. Unprotect them to allow repair.
6. Choose **Review a recovery plan**. Review before/after allocations, goal budgets/deadlines, changed task estimates, warnings and unplaced work. Nothing is applied yet.
7. Accept explicitly or discard. Acceptance applies goal/estimate changes, availability and the accepted schedule together through the existing validated persistence boundary.
8. **Undo last accepted change (this session)** restores the previous goals, settings, schedule and history. It is disabled after further board changes to avoid overwriting newer work. Reloading ends the undo session; bounded accepted schedule history remains in backups.

## Algorithm and limits

The background worker validates its inputs, reserves protected work and its breaks/weekly budgets, and creates a dependency-aware allocation for the remaining tasks. A bounded greedy pass tries to restore feasible previous whole-task allocations; an independent validator approves each retained alternative. At most 200 unprotected candidate task groups are examined. The worker retains its existing five-second cancellation/deadline boundary.

This is a stability heuristic, not an optimizer proving a minimum number of moves or impossibility of alternatives. It may move partially allocated tasks or move some tasks even when another arrangement could preserve more. Protection can make a repair fail; it never silently overrides the requested protection. Constraint conflicts remain visible. Reduce scope, adjust availability/budgets/deadlines, or unprotect work and try again.

Missed sessions do not count as completed effort. Existing tasks have completion flags and total estimates, not partial time logs. A changed estimate is the total estimate for an unfinished task. No prediction of completion probability is made.

Protection selections are scoped to a repair, not permanent database flags. No schema migration is needed. Existing JSON board backups remain compatible. Account documents continue to require explicit cloud saving; undo and recovery do not bypass that boundary.

## Verification

The domain tests cover retention versus a fresh allocation, deterministic/no-mutation behavior, protected capacity, conflicting availability, dependency ordering, deadlines, missed work, completed/re-estimated tasks, smaller budgets and malformed options. Browser verification checks the full proposal/accept/undo flow and invalid protection without an external service. Live OAuth/cloud configuration remains separately pending.

Browser checks on October 31, 2026: generated a protected recovery from a four-hour to one-hour weekly budget, accepted it, and undid it to recover the original nine-session schedule and four-hour budget. A 30-minute budget rejected a protected 45-minute task. Changing inputs removed the previous preview; editing the board after generating recovery prevented stale acceptance. Desktop (1440×1000) and mobile (390×844) views had no horizontal overflow, and the browser error query returned no entries. Tests and build run without cloud credentials.
