import { clockMinutes, validTimezone } from "./time.ts";
import type { PlanningState, ScheduleSettings } from "./schedule-types.ts";
const object = (v: unknown): v is Record<string, any> =>
	!!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) =>
	typeof v === "string" && v.length > 0 && v.length <= 160;
const date = (v: unknown) =>
	typeof v === "string" &&
	/^\d{4}-\d{2}-\d{2}$/.test(v) &&
	Number.isFinite(Date.parse(`${v}T12:00:00Z`)) &&
	new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const instant = (v: unknown) =>
	typeof v === "string" &&
	Number.isFinite(Date.parse(v)) &&
	new Date(v).toISOString() === v;
export function settingsErrors(settings: ScheduleSettings): string[] {
	const errors: string[] = [];
	if (!settings || !validTimezone(settings.timezone))
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
			!object(w) ||
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
			!object(c) ||
			!id(c.id) ||
			ids.has(c.id) ||
			!date(c.date) ||
			typeof c.title !== "string" ||
			!c.title.trim() ||
			c.title.length > 160 ||
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
		!object(value) ||
		!object(value.settings) ||
		settingsErrors(value.settings as ScheduleSettings).length ||
		!Array.isArray(value.history) ||
		value.history.length > 10
	)
		return false;
	const snapshots = [
		...value.history,
		...(value.accepted ? [value.accepted] : []),
	];
	return snapshots.every(
		(s) =>
			object(s) &&
			id(s.id) &&
			s.algorithm === "earliest-deadline-v1" &&
			instant(s.createdAt) &&
			id(s.inputRevision) &&
			Array.isArray(s.sessions) &&
			s.sessions.length <= 10000 &&
			s.sessions.every(
				(x: unknown) =>
					object(x) &&
					id(x.id) &&
					id(x.taskId) &&
					id(x.goalId) &&
					id(x.title) &&
					instant(x.start) &&
					instant(x.end) &&
					Date.parse(x.end) > Date.parse(x.start),
			) &&
			new Set(s.sessions.map((x: any) => x.id)).size === s.sessions.length &&
			Array.isArray(s.unscheduled) &&
			s.unscheduled.length <= 1000 &&
			s.unscheduled.every(
				(x: unknown) =>
					object(x) &&
					id(x.taskId) &&
					id(x.title) &&
					Number.isInteger(x.remainingMinutes) &&
					x.remainingMinutes > 0 &&
					[
						"DEPENDENCY_BLOCKED",
						"INSUFFICIENT_CAPACITY",
						"DEADLINE_PASSED",
					].includes(x.reason),
			) &&
			Array.isArray(s.warnings) &&
			s.warnings.length <= 100 &&
			s.warnings.every(
				(x: unknown) => typeof x === "string" && x.length <= 1000,
			),
	);
}
