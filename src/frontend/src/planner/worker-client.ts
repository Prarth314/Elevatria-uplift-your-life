import type { RepairOptions } from "./recovery.ts";
import type { Workspace } from "./model.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import { validPlanning } from "./schedule-validation.ts";
import { workerRequest } from "./worker-transport.ts";
import { plain } from "./structure.ts";
import { inputRevision, scheduleViolations } from "./scheduler.ts";
export function decodeSchedule(
	workspace: Workspace,
	settings: ScheduleSettings,
	result: unknown,
): Schedule {
	if (!plain(result, ["error", "schedule"]))
		throw Error("Scheduling returned an invalid response.");
	if (result.error)
		throw Error(
			typeof result.error === "string" ? result.error : "Scheduling failed.",
		);
	if (!validPlanning({ settings, accepted: result.schedule, history: [] }))
		throw Error("Scheduling returned invalid data.");
	const schedule = result.schedule as Schedule;
	if (schedule.inputRevision !== inputRevision(workspace, settings))
		throw Error("Scheduling returned a stale response. Generate again.");
	const violations = scheduleViolations(workspace, settings, schedule);
	if (violations.length)
		throw Error(
			"Scheduling returned invalid allocations: " + violations.join(" "),
		);
	return schedule;
}
export function computeSchedule(
	workspace: Workspace,
	settings: ScheduleSettings,
	signal: AbortSignal,
	repair?: RepairOptions,
): Promise<Schedule> {
	if (typeof Worker === "undefined")
		return Promise.reject(
			Error(
				"This browser does not support background scheduling. You can continue editing and exporting your plan.",
			),
		);
	return workerRequest(
		() =>
			new Worker(new URL("./schedule.worker.ts", import.meta.url), {
				type: "module",
			}),
		{
			workspace: { version: 1, goals: workspace.goals, items: [] },
			settings,
			now: new Date().toISOString(),
			repair,
		},
		signal,
		(result) => decodeSchedule(workspace, settings, result),
	);
}
