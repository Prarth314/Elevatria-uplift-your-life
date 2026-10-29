import { newId, progress } from "./model.ts";
import type { Goal, Milestone, Task } from "./model.ts";

/** A transparent local starter, deliberately not presented as AI output. */
export function generatePlan(goal: Goal): Milestone[] {
	const phases: [string, [string, number][]][] = [
		[
			"Define the destination",
			[
				[`Define what success means for “${goal.title}”`.slice(0, 160), 30],
				["List the resources, skills, and support you need", 45],
				["Choose one small deliverable and write its acceptance criteria", 30],
			],
		],
		[
			"Build a first version",
			[
				["Complete a focused first attempt at your deliverable", 90],
				["Review the result against your acceptance criteria", 30],
				["Improve the weakest part with another focused attempt", 90],
			],
		],
		[
			"Reflect and finish",
			[
				["Get feedback from someone you trust", 30],
				["Apply feedback and complete your deliverable", 60],
				["Record the result and choose your next step", 30],
			],
		],
	];
	return phases.map(([title, tasks]) => ({
		id: newId(),
		title,
		tasks: tasks.map(([title, minutes]) => ({
			id: newId(),
			title,
			minutes,
			completed: false,
		})),
	}));
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
