import type { Workspace } from "./model.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import { validPlanning } from "./schedule-validation.ts";
export function computeSchedule(
	workspace: Workspace,
	settings: ScheduleSettings,
	signal: AbortSignal,
): Promise<Schedule> {
	if (typeof Worker === "undefined")
		return Promise.reject(
			Error(
				"This browser does not support background scheduling. You can continue editing and exporting your plan.",
			),
		);
	if (signal.aborted)
		return Promise.reject(new DOMException("Cancelled", "AbortError"));
	return new Promise((resolve, reject) => {
		const worker = new Worker(
			new URL("./schedule.worker.ts", import.meta.url),
			{ type: "module" },
		);
		const stop = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", abort);
			worker.terminate();
		};
		const abort = () => {
			stop();
			reject(new DOMException("Cancelled", "AbortError"));
		};
		const timer = setTimeout(() => {
			stop();
			reject(
				Error(
					"Scheduling exceeded the five-second limit. Reduce the horizon or task count and retry.",
				),
			);
		}, 5000);
		signal.addEventListener("abort", abort, { once: true });
		worker.onmessage = (event) => {
			stop();
			const result = event.data;
			if (!result || typeof result !== "object")
				return reject(Error("Scheduling returned an invalid response."));
			if (result.error)
				return reject(
					Error(
						typeof result.error === "string"
							? result.error
							: "Scheduling failed.",
					),
				);
			if (!validPlanning({ settings, accepted: result.schedule, history: [] }))
				return reject(Error("Scheduling returned invalid data."));
			resolve(result.schedule);
		};
		worker.onerror = () => {
			stop();
			reject(
				Error(
					"Background scheduling failed. Your accepted schedule is unchanged.",
				),
			);
		};
		// Do not copy images, account documents, or history into the worker.
		worker.postMessage({
			workspace: { version: 1, goals: workspace.goals, items: [] },
			settings,
			now: new Date().toISOString(),
		});
	});
}
