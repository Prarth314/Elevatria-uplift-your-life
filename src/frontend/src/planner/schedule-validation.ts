import { clockMinutes, validTimezone } from "./time.ts";
import type { PlanningState, ScheduleSettings } from "./schedule-types.ts";
import {
	plain,
	identifier as id,
	label,
	calendarDate as date,
	isoInstant as instant,
	boundedText,
	LIMITS,
} from "./structure.ts";
export function settingsErrors(settings: ScheduleSettings): string[] {
	const errors: string[] = [];
	if (
		!plain(settings, [
			"timezone",
			"horizonDays",
			"sessionMinutes",
			"breakMinutes",
			"windows",
			"commitments",
		]) ||
		!validTimezone(settings.timezone)
	)
		errors.push("Choose a valid IANA timezone, such as America/Chicago.");
	if (
		!Number.isInteger(settings?.horizonDays) ||
		settings.horizonDays < 1 ||
		settings.horizonDays > 56
	)
		errors.push("Planning horizon must be 1–56 days.");
	if (
		!Number.isInteger(settings?.sessionMinutes) ||
		settings.sessionMinutes < 15 ||
		settings.sessionMinutes > 120
	)
		errors.push("Sessions must be 15–120 minutes.");
	if (
		!Number.isInteger(settings?.breakMinutes) ||
		settings.breakMinutes < 0 ||
		settings.breakMinutes > 60
	)
		errors.push("Breaks must be 0–60 minutes.");
	if (
		!Array.isArray(settings?.windows) ||
		settings.windows.length > 28 ||
		!Array.isArray(settings?.commitments) ||
		settings.commitments.length > 100
	)
		return [...errors, "Availability exceeds supported limits."];
	const ids = new Set();
	for (const w of settings.windows) {
		if (
			!plain(w, ["id", "weekday", "start", "end"]) ||
			!id(w.id) ||
			ids.has(w.id) ||
			!Number.isInteger(w.weekday) ||
			w.weekday < 0 ||
			w.weekday > 6 ||
			!(clockMinutes(w.start) < clockMinutes(w.end))
		)
			errors.push(
				"Each availability window needs a unique ID, weekday, and same-day start before end.",
			);
		ids.add(w?.id);
	}
	for (const c of settings.commitments) {
		if (
			!plain(c, ["id", "date", "start", "end", "title"]) ||
			!id(c.id) ||
			ids.has(c.id) ||
			!date(c.date) ||
			!label(c.title) ||
			!(clockMinutes(c.start) < clockMinutes(c.end))
		)
			errors.push(
				"Each commitment needs a unique ID, date, title, and same-day time range.",
			);
		ids.add(c?.id);
	}
	if (!errors.length)
		for (let day = 0; day < 7; day++) {
			const windows = settings.windows
				.filter((w) => w.weekday === day)
				.sort((a, b) => a.start.localeCompare(b.start));
			if (windows.some((w, i) => i > 0 && w.start < windows[i - 1].end))
				errors.push(
					"Availability windows on the same weekday must not overlap.",
				);
		}
	return [...new Set(errors)];
}
export function validPlanning(value: unknown): value is PlanningState {
	if (
		!plain(value, ["settings", "accepted", "history"]) ||
		!plain(value.settings, [
			"timezone",
			"horizonDays",
			"sessionMinutes",
			"breakMinutes",
			"windows",
			"commitments",
		]) ||
		settingsErrors(value.settings as unknown as ScheduleSettings).length ||
		!Array.isArray(value.history) ||
		value.history.length > 10
	)
		return false;
	const snapshots = [
		...value.history,
		...(value.accepted === undefined ? [] : [value.accepted]),
	];
	let totalSessions = 0;
	for (const s of snapshots) {
		if (
			!plain(s, [
				"id",
				"algorithm",
				"createdAt",
				"inputRevision",
				"sessions",
				"unscheduled",
				"warnings",
			]) ||
			!id(s.id) ||
			s.algorithm !== "earliest-deadline-v1" ||
			!instant(s.createdAt) ||
			!id(s.inputRevision) ||
			!Array.isArray(s.sessions) ||
			s.sessions.length > LIMITS.sessionsPerVersion ||
			!Array.isArray(s.unscheduled) ||
			s.unscheduled.length > LIMITS.tasks ||
			!Array.isArray(s.warnings) ||
			s.warnings.length > 100
		)
			return false;
		totalSessions += s.sessions.length;
		if (totalSessions > LIMITS.sessionsAcrossHistory) return false;
		const ids = new Set<string>();
		for (const x of s.sessions) {
			if (
				!plain(x, ["id", "taskId", "goalId", "title", "start", "end"]) ||
				!id(x.id) ||
				ids.has(x.id) ||
				!id(x.taskId) ||
				!id(x.goalId) ||
				!label(x.title) ||
				!instant(x.start) ||
				!instant(x.end) ||
				Date.parse(x.end) <= Date.parse(x.start) ||
				Date.parse(x.end) - Date.parse(x.start) > 120 * 60000
			)
				return false;
			ids.add(x.id);
		}
		const taskIds = new Set<string>();
		for (const x of s.unscheduled) {
			if (
				!plain(x, ["taskId", "title", "remainingMinutes", "reason"]) ||
				!id(x.taskId) ||
				taskIds.has(x.taskId) ||
				!label(x.title) ||
				!Number.isInteger(x.remainingMinutes) ||
				(x.remainingMinutes as number) < 1 ||
				(x.remainingMinutes as number) > 480 ||
				![
					"DEPENDENCY_BLOCKED",
					"INSUFFICIENT_CAPACITY",
					"DEADLINE_PASSED",
				].includes(String(x.reason))
			)
				return false;
			taskIds.add(x.taskId);
		}
		if (!s.warnings.every((x) => boundedText(x, 1000))) return false;
	}
	return true;
}
