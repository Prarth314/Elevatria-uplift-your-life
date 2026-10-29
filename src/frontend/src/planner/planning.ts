import { templates } from "./templates.ts";
import { newId, progress } from "./model.ts";
import type { Goal, Milestone, Task } from "./model.ts";

/** A transparent local starter, deliberately not presented as AI output. */
export function generatePlan(goal: Goal): Milestone[] {
	const phases = templates[goal.category ?? "custom"];
	const milestones = phases.map(([title, tasks]) => ({
		id: newId(),
		title,
		tasks: tasks.map(([title, minutes]) => ({
			id: newId(),
			title,
			minutes,
			completed: false,
		})),
	}));
	let previous: string | undefined;
	for (const milestone of milestones)
		for (const task of milestone.tasks) {
			(task as Task).dependsOn = previous ? [previous] : [];
			previous = task.id;
		}
	return milestones;
}

/** Capacity estimate only: no time slots, dependency guarantees, or calendar events. */
export function capacity(goal: Goal, today: string) {
	const days = Math.max(
		0,
		Math.round(
			(Date.parse(`${goal.targetDate}T00:00:00Z`) -
				Date.parse(`${today}T00:00:00Z`)) /
				86_400_000,
		) + 1,
	);
	const available = Math.floor((days / 7) * goal.weeklyHours * 60);
	const remaining = progress(goal).remaining;
	return {
		days,
		available,
		remaining,
		over: remaining > available,
		weeks: Math.ceil(remaining / (goal.weeklyHours * 60)),
	};
}

export function weeklyFocus(goal: Goal) {
	let remainingBudget = Math.round(goal.weeklyHours * 60);
	const focus: Task[] = [];
	// Keep order and stop at the first task that doesn't fit; don't silently split it.
	for (const task of goal.milestones
		.flatMap((m) => m.tasks)
		.filter((t) => !t.completed)) {
		if (task.minutes > remainingBudget) break;
		focus.push(task);
		remainingBudget -= task.minutes;
	}
	return focus;
}
