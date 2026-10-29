import { generateSchedule } from "./scheduler.ts";
import { validWorkspace } from "./model.ts";
import { settingsErrors } from "./schedule-validation.ts";
import { isoInstant, plain } from "./structure.ts";
import type { ScheduleSettings } from "./schedule-types.ts";
const scope = self as unknown as {
	onmessage: ((event: MessageEvent<unknown>) => void) | null;
	postMessage: (value: unknown) => void;
};
scope.onmessage = (event) => {
	try {
		const data = event.data;
		if (
			!plain(data, ["workspace", "settings", "now"]) ||
			!validWorkspace(data.workspace) ||
			!plain(data.settings, [
				"timezone",
				"horizonDays",
				"sessionMinutes",
				"breakMinutes",
				"windows",
				"commitments",
			]) ||
			!isoInstant(data.now) ||
			settingsErrors(data.settings as unknown as ScheduleSettings).length
		)
			throw Error("Scheduling inputs are invalid or exceed supported limits.");
		scope.postMessage({
			schedule: generateSchedule(
				data.workspace,
				data.settings as unknown as ScheduleSettings,
				data.now,
			),
		});
	} catch (error) {
		scope.postMessage({
			error: error instanceof Error ? error.message : "Scheduling failed.",
		});
	}
};
