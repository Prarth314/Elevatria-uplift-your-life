import type { Workspace } from "./model.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import { inputRevision, scheduleViolations } from "./scheduler.ts";

/** Shared acceptance boundary; proposal is ephemeral until this check and the save succeed. */
export function proposalErrors(
	workspace: Workspace,
	settings: ScheduleSettings,
	proposal: Schedule,
	now = Date.now(),
): string[] {
	if (proposal.inputRevision !== inputRevision(workspace, settings))
		return [
			"This proposal is stale. Generate again using the latest goals and availability.",
		];
	if (proposal.sessions.some((s) => Date.parse(s.start) < now))
		return [
			"A proposed session is already in the past. Generate a fresh proposal.",
		];
	return scheduleViolations(workspace, settings, proposal);
}
