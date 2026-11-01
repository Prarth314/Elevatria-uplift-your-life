import type { Workspace } from "./model.ts";
import type {
	Schedule,
	ScheduleSettings,
	Session,
	Unscheduled,
} from "./schedule-types.ts";
import { availableSlots } from "./scheduler.ts";
import { dateAt, wallInstant } from "./time.ts";

/** Facts from the reviewed allocation, not a reconstructed solver execution trace. */
export function placementFacts(
	workspace: Workspace,
	settings: ScheduleSettings,
	schedule: Schedule,
	session: Session,
): string[] {
	const goal = workspace.goals.find((g) => g.id === session.goalId);
	const task = goal?.milestones
		.flatMap((m) => m.tasks)
		.find((t) => t.id === session.taskId);
	if (!goal || !task)
		return [
			"Historical allocation; its task is no longer in the current board.",
		];
	const date = dateAt(Date.parse(session.start), settings.timezone);
	const facts = [
		`${(Date.parse(session.end) - Date.parse(session.start)) / 60000} minutes allocated; task estimate ${task.minutes} minutes.`,
		`Goal deadline ${goal.targetDate}; goal cap ${goal.weeklyHours} hours per Monday–Sunday week.`,
	];
	const window = settings.windows.find(
		(w) =>
			w.weekday === new Date(date + "T12:00:00Z").getUTCDay() &&
			(wallInstant(date, w.start, settings.timezone) ?? Infinity) <=
				Date.parse(session.start) &&
			(wallInstant(date, w.end, settings.timezone) ?? -Infinity) >=
				Date.parse(session.end),
	);
	if (window)
		facts.push(
			`Inside the ${window.start}–${window.end} work window in ${settings.timezone}, after subtracting fixed commitments.`,
		);
	for (const id of task.dependsOn ?? []) {
		const parent = workspace.goals
			.flatMap((g) => g.milestones.flatMap((m) => m.tasks))
			.find((t) => t.id === id);
		const sessions = schedule.sessions
			.filter((s) => s.taskId === id)
			.sort((a, b) => a.end.localeCompare(b.end));
		facts.push(
			parent?.completed
				? `Prerequisite “${parent.title}” is recorded complete.`
				: `Prerequisite “${parent?.title ?? id}” has its final allocation ending ${sessions.at(-1)?.end ?? "outside this snapshot"}.`,
		);
	}
	facts.push(
		`Session maximum ${settings.sessionMinutes} minutes; required gap between allocations ${settings.breakMinutes} minutes. These are allocation facts, not a proof that this is the only or best time.`,
	);
	return facts;
}

export function unplacedExplanation(
	workspace: Workspace,
	settings: ScheduleSettings,
	schedule: Schedule,
	work: Unscheduled,
) {
	const goal = workspace.goals.find((g) =>
		g.milestones.some((m) => m.tasks.some((t) => t.id === work.taskId)),
	);
	if (work.reason === "DEADLINE_PASSED")
		return {
			kind: "proven" as const,
			reason:
				"The goal deadline precedes the planning date; no future allocation can meet it.",
			adjustment: "Change the goal deadline or remove this work from the plan.",
		};
	if (work.reason === "DEPENDENCY_BLOCKED")
		return {
			kind: "heuristic" as const,
			reason:
				"At least one prerequisite was not fully placed by this run. Dependent work must wait.",
			adjustment:
				"Review the prerequisite’s unplaced work first. Another ordering may place more work.",
		};
	const slots = availableSlots(
		settings,
		Date.parse(schedule.createdAt),
	).slots.filter((s) => !goal || s.date <= goal.targetDate);
	if (!slots.length)
		return {
			kind: "proven" as const,
			reason:
				"There is no future free work window before this goal’s deadline within the selected horizon.",
			adjustment:
				"Add a work window, remove a conflicting commitment, or extend the deadline/horizon (up to 56 days).",
		};
	return {
		kind: "heuristic" as const,
		reason:
			"This run left work unplaced under shared capacity, per-goal weekly caps, deadlines, prerequisite order, breaks and the 15-minute fragment rule. It does not identify a unique bottleneck or prove infeasibility.",
		adjustment:
			"More shared availability, a higher goal budget, a later deadline, or smaller scope; compare the resulting proposal before accepting.",
	};
}

const allocationKey = (s: Session) =>
	JSON.stringify([s.taskId, s.goalId, s.start, s.end]);
export function allocationSummary(
	previous: Schedule | undefined,
	next: Schedule,
) {
	const before = previous?.sessions ?? [],
		after = next.sessions;
	const old = new Set(before.map(allocationKey)),
		current = new Set(after.map(allocationKey));
	const retained = after.filter((s) => old.has(allocationKey(s))).length;
	const removed = before.filter((s) => !current.has(allocationKey(s)));
	const added = after.filter((s) => !old.has(allocationKey(s)));
	const oldTasks = new Set(before.map((s) => s.taskId)),
		nextTasks = new Set(after.map((s) => s.taskId));
	return {
		retained,
		// Changed allocations are grouped by task, without pretending to match split events one-to-one.
		changedTasks: new Set(
			[...removed, ...added]
				.filter((s) => oldTasks.has(s.taskId) && nextTasks.has(s.taskId))
				.map((s) => s.taskId),
		).size,
		removed: removed.filter((s) => !nextTasks.has(s.taskId)).length,
		added: added.filter((s) => !oldTasks.has(s.taskId)).length,
		beforeUnplaced:
			previous?.unscheduled.reduce((n, t) => n + t.remainingMinutes, 0) ?? 0,
		afterUnplaced: next.unscheduled.reduce((n, t) => n + t.remainingMinutes, 0),
	};
}
