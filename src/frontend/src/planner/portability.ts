import { validWorkspace } from "./model.ts";
import type { Workspace } from "./model.ts";
import type { Schedule } from "./schedule-types.ts";
import { inputRevision, scheduleViolations } from "./scheduler.ts";
/** Export exactly the accepted snapshot, never a proposal or a stale allocation. */
export function acceptedCalendarFile(
	workspace: Workspace,
	now = new Date().toISOString(),
): string {
	const planning = workspace.planning;
	if (
		!planning?.accepted ||
		planning.accepted.inputRevision !==
			inputRevision(workspace, planning.settings)
	)
		throw Error(
			"Review and accept a schedule for the current plan before exporting.",
		);
	const errors = scheduleViolations(
		workspace,
		planning.settings,
		planning.accepted,
	);
	if (errors.length) throw Error(errors.join(" "));
	return calendarFile(planning.accepted, now);
}
export function parseBackup(raw: string): Workspace {
	if (new TextEncoder().encode(raw).length > 8_000_000)
		throw Error("Backup exceeds the 8 MB import limit.");
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw Error("The file is not valid JSON. Your board has not changed.");
	}
	if (!validWorkspace(value))
		throw Error(
			"Backup version, dates, dependencies, or saved planning data are invalid. Your board has not changed.",
		);
	return value;
}
const escapeText = (value: string) =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/\r\n|\r|\n/g, "\\n")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,");
function stamp(value: string) {
	const d = new Date(value);
	if (!Number.isFinite(d.getTime())) throw Error("Invalid event date.");
	return d
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}
function fold(line: string): string {
	const encoder = new TextEncoder();
	const lines: string[] = [];
	let current = "",
		bytes = 0;
	for (const character of line) {
		const size = encoder.encode(character).length;
		if (bytes + size > 75) {
			lines.push(current);
			current = " ";
			bytes = 1;
		}
		current += character;
		bytes += size;
	}
	return [...lines, current].join("\r\n");
}
/** Stable occurrence UIDs; repeated import behavior still depends on the calendar application. */
export function calendarFile(
	schedule: Schedule,
	now = new Date().toISOString(),
): string {
	const counts = new Map<string, number>();
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Elevatria//Goal Planner//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
	];
	const sessions = [...schedule.sessions].sort((a, b) =>
		a.start.localeCompare(b.start),
	);
	for (const session of sessions) {
		if (Date.parse(session.end) <= Date.parse(session.start))
			throw Error("Event end must follow start.");
		const occurrence = counts.get(session.taskId) ?? 0;
		counts.set(session.taskId, occurrence + 1);
		lines.push(
			"BEGIN:VEVENT",
			`UID:${encodeURIComponent(session.taskId)}-${occurrence}@elevatria.local`,
			`DTSTAMP:${stamp(now)}`,
			`DTSTART:${stamp(session.start)}`,
			`DTEND:${stamp(session.end)}`,
			`SUMMARY:${escapeText(session.title)}`,
			`DESCRIPTION:${escapeText("Planned with Elevatria — Uplift Your Life. Review changes in Elevatria before exporting a revised schedule.")}`,
			"END:VEVENT",
		);
	}
	lines.push("END:VCALENDAR");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
export function downloadFile(contents: string, filename: string, type: string) {
	const url = URL.createObjectURL(new Blob([contents], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
