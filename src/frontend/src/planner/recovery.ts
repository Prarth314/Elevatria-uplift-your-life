import { plain, identifier } from "./structure.ts";
import type { Workspace } from "./model.ts";
import type { Schedule, ScheduleSettings, Session } from "./schedule-types.ts";
import { generateSchedule, scheduleValidator } from "./scheduler.ts";
import { validPlanning } from "./schedule-validation.ts";
export interface RepairOptions {
	previous: Schedule;
	protectedTaskIds: string[];
}
export function repairSchedule(
	workspace: Workspace,
	settings: ScheduleSettings,
	options: RepairOptions,
	now = new Date().toISOString(),
): Schedule {
	if (
		!plain(options, ["previous", "protectedTaskIds"]) ||
		!validPlanning({ settings, accepted: options.previous, history: [] }) ||
		!Array.isArray(options.protectedTaskIds) ||
		options.protectedTaskIds.length > 1000 ||
		new Set(options.protectedTaskIds).size !==
			options.protectedTaskIds.length ||
		!options.protectedTaskIds.every((id) => identifier(id))
	)
		throw Error("Recovery inputs are invalid.");
	const tasks = new Map(
		workspace.goals
			.flatMap((g) => g.milestones.flatMap((m) => m.tasks))
			.map((t) => [t.id, t]),
	);
	const groups = new Map<string, Session[]>();
	for (const session of options.previous.sessions) {
		const list = groups.get(session.taskId) ?? [];
		list.push(session);
		groups.set(session.taskId, list);
	}
	const usable = (id: string) => {
		const task = tasks.get(id),
			group = groups.get(id);
		return (
			!!task &&
			!task.completed &&
			!!group?.length &&
			group.every((s) => Date.parse(s.start) >= Date.parse(now)) &&
			group.reduce(
				(n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 60000,
				0,
			) === task.minutes
		);
	};
	for (const id of options.protectedTaskIds)
		if (!usable(id))
			throw Error(
				"Protected work is missing, completed, changed in duration, or partly in the past. Unprotect it and try again.",
			);
	let result = generateSchedule(
		workspace,
		settings,
		now,
		options.protectedTaskIds.flatMap((id) =>
			groups.get(id)!.map((s) => ({ ...s, title: tasks.get(id)!.title })),
		),
	);
	// Bounded greedy repair: retain whole task allocations only when the independent validator approves.
	// This is a stability heuristic, not a proof of a globally minimal repair.
	let checks = 0;
	const validate = scheduleValidator(workspace, settings);
	for (const [id, group] of groups) {
		if (
			options.protectedTaskIds.includes(id) ||
			!usable(id) ||
			result.unscheduled.some((t) => t.taskId === id)
		)
			continue;
		if (++checks > 200) break;
		const task = tasks.get(id)!;
		const candidate = {
			...result,
			sessions: [
				...result.sessions.filter((s) => s.taskId !== id),
				...group.map((s) => ({ ...s, title: task.title })),
			].sort((a, b) => a.start.localeCompare(b.start)),
		};
		if (!validate(candidate).length) result = candidate;
	}
	return result;
}
