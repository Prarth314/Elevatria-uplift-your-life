import { validPlanning } from "./schedule-validation.ts";
import type { Workspace } from "./model.ts";
import type {
	ScheduleSettings,
	Schedule,
	Session,
	Unscheduled,
} from "./schedule-types.ts";
import { settingsErrors } from "./schedule-validation.ts";
import { dependencyErrors } from "./dependencies.ts";
import { addDays, dateAt, wallInstant } from "./time.ts";
export const ALGORITHM = "earliest-deadline-v1" as const;
const minute = 60000;
export function inputRevision(
	workspace: Workspace,
	settings: ScheduleSettings,
): string {
	// A reproducible snapshot fingerprint, not an authentication or cryptographic primitive.
	const raw = JSON.stringify({ goals: workspace.goals, settings });
	let a = 2166136261,
		b = 5381;
	for (let i = 0; i < raw.length; i++) {
		a = Math.imul(a ^ raw.charCodeAt(i), 16777619);
		b = Math.imul(b, 33) ^ raw.charCodeAt(i);
	}
	return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${raw.length}`;
}
export interface Slot {
	start: number;
	end: number;
	date: string;
}
export function availableSlots(
	settings: ScheduleSettings,
	now: number,
): { slots: Slot[]; warnings: string[] } {
	const errors = settingsErrors(settings);
	if (errors.length) throw Error(errors.join(" "));
	const slots: Slot[] = [],
		warnings: string[] = [];
	const today = dateAt(now, settings.timezone);
	for (let day = 0; day < settings.horizonDays; day++) {
		const date = addDays(today, day),
			weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
		for (const window of settings.windows.filter(
			(w) => w.weekday === weekday,
		)) {
			const start = wallInstant(date, window.start, settings.timezone),
				end = wallInstant(date, window.end, settings.timezone);
			if (start === null || end === null || end <= start) {
				warnings.push(
					`Skipped ${date} ${window.start}–${window.end}: the timezone clock changes in this window.`,
				);
				continue;
			}
			let pieces: Slot[] = [
				{ start: Math.max(Math.ceil(now / minute) * minute, start), end, date },
			].filter((s) => s.start < s.end);
			for (const c of settings.commitments.filter((c) => c.date === date)) {
				const cs = wallInstant(date, c.start, settings.timezone),
					ce = wallInstant(date, c.end, settings.timezone);
				// An ambiguous/nonexistent commitment must not accidentally expose free time.
				if (cs === null || ce === null || ce <= cs) {
					pieces = [];
					warnings.push(
						`Blocked ${date}: commitment “${c.title}” crosses an invalid wall time. Adjust it before scheduling.`,
					);
					break;
				}
				pieces = pieces.flatMap((s) =>
					ce <= s.start || cs >= s.end
						? [s]
						: [
								{ ...s, end: Math.min(cs, s.end) },
								{ ...s, start: Math.max(ce, s.start) },
							].filter((x) => x.end > x.start),
				);
			}
			slots.push(...pieces);
		}
	}
	return {
		slots: slots.sort((a, b) => a.start - b.start),
		warnings: [...new Set(warnings)].slice(0, 100),
	};
}
function weekOf(date: string) {
	const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
	return addDays(date, -((weekday + 6) % 7));
}
export function generateSchedule(
	workspace: Workspace,
	settings: ScheduleSettings,
	nowISO = new Date().toISOString(),
): Schedule {
	const now = Date.parse(nowISO);
	if (!Number.isFinite(now)) throw Error("The scheduling clock is invalid.");
	const graphErrors = dependencyErrors(workspace);
	if (graphErrors.length) throw Error(graphErrors.join(" "));
	const tasks = workspace.goals.flatMap((g) =>
		g.milestones.flatMap((m) => m.tasks.map((t) => ({ ...t, goal: g }))),
	);
	if (tasks.length > 1000)
		throw Error("Scheduling supports at most 1,000 tasks per workspace.");
	const order = new Map(tasks.map((task, index) => [task.id, index]));
	const { slots, warnings } = availableSlots(settings, now);
	const sessions: Session[] = [],
		unscheduled: Unscheduled[] = [];
	const finish = new Map(
		tasks.filter((t) => t.completed).map((t) => [t.id, now]),
	);
	const processed = new Set(finish.keys()),
		weekly = new Map<string, number>();
	const pending = tasks.filter((t) => !t.completed);
	while (pending.length) {
		const eligible = pending
			.filter((t) => (t.dependsOn ?? []).every((id) => processed.has(id)))
			.sort(
				(a, b) =>
					a.goal.targetDate.localeCompare(b.goal.targetDate) ||
					(b.goal.priority ?? 2) - (a.goal.priority ?? 2) ||
					order.get(a.id)! - order.get(b.id)! ||
					a.id.localeCompare(b.id),
			);
		if (!eligible.length)
			throw Error("The dependency graph cannot be scheduled.");
		const task = eligible[0];
		pending.splice(
			pending.findIndex((t) => t.id === task.id),
			1,
		);
		processed.add(task.id);
		if ((task.dependsOn ?? []).some((id) => !finish.has(id))) {
			unscheduled.push({
				taskId: task.id,
				title: task.title,
				remainingMinutes: task.minutes,
				reason: "DEPENDENCY_BLOCKED",
			});
			continue;
		}
		const earliest = Math.max(
			now,
			...(task.dependsOn ?? []).map((id) => finish.get(id)!),
		);
		let remaining = task.minutes,
			lastEnd = earliest;
		for (const slot of slots) {
			if (!remaining) break;
			if (slot.date > task.goal.targetDate) continue;
			const key = `${task.goal.id}:${weekOf(slot.date)}`;
			let budget = Math.max(
				0,
				Math.floor(task.goal.weeklyHours * 60) - (weekly.get(key) ?? 0),
			);
			let start = Math.max(slot.start, earliest);
			while (remaining > 0 && budget > 0 && start < slot.end) {
				const duration = Math.min(
					remaining,
					settings.sessionMinutes,
					budget,
					Math.floor((slot.end - start) / minute),
				);
				// Avoid unusable fragments, except when the entire remaining task is short.
				if (duration < Math.min(15, remaining)) break;
				const end = start + duration * minute;
				sessions.push({
					id: `${task.id.slice(0, 120)}:${start}`,
					taskId: task.id,
					goalId: task.goal.id,
					title: task.title,
					start: new Date(start).toISOString(),
					end: new Date(end).toISOString(),
				});
				remaining -= duration;
				budget -= duration;
				weekly.set(key, (weekly.get(key) ?? 0) + duration);
				lastEnd = end;
				for (const other of slots) {
					if (
						other.start < end + settings.breakMinutes * minute &&
						other.end > start - settings.breakMinutes * minute
					)
						other.start = Math.max(
							other.start,
							end + settings.breakMinutes * minute,
						);
				}
				slot.start = end + settings.breakMinutes * minute;
				start = slot.start;
			}
		}
		if (!remaining) finish.set(task.id, lastEnd);
		else
			unscheduled.push({
				taskId: task.id,
				title: task.title,
				remainingMinutes: remaining,
				reason:
					task.goal.targetDate < dateAt(now, settings.timezone)
						? "DEADLINE_PASSED"
						: "INSUFFICIENT_CAPACITY",
			});
	}
	const revision = inputRevision(workspace, settings);
	const result: Schedule = {
		id: `${revision}:${now}`,
		algorithm: ALGORITHM,
		createdAt: new Date(now).toISOString(),
		inputRevision: revision,
		sessions: sessions.sort((a, b) => a.start.localeCompare(b.start)),
		unscheduled,
		warnings,
	};
	const violations = scheduleViolations(workspace, settings, result);
	if (violations.length)
		throw Error(`Schedule validation failed: ${violations.join(" ")}`);
	return result;
}
/** Independent invariant check. Never rely on a generator's output alone. */
export function scheduleViolations(
	workspace: Workspace,
	settings: ScheduleSettings,
	schedule: Schedule,
): string[] {
	if (!validPlanning({ settings, accepted: schedule, history: [] }))
		return ["Schedule data is invalid or exceeds supported limits."];
	const errors: string[] = [];
	const tasks = workspace.goals.flatMap((g) =>
		g.milestones.flatMap((m) => m.tasks.map((t) => ({ ...t, goal: g }))),
	);
	const byId = new Map(tasks.map((t) => [t.id, t])),
		effort = new Map<string, number>(),
		weekly = new Map<string, number>(),
		grouped = new Map<string, Session[]>();
	const { slots } = availableSlots(settings, Date.parse(schedule.createdAt));
	const sessions = [...schedule.sessions].sort((a, b) =>
		a.start.localeCompare(b.start),
	);
	for (let i = 0; i < sessions.length; i++) {
		const s = sessions[i],
			t = byId.get(s.taskId),
			start = Date.parse(s.start),
			end = Date.parse(s.end),
			duration = (end - start) / minute;
		if (!t || t.completed || t.goal.id !== s.goalId) {
			errors.push("Session references missing or completed work.");
			continue;
		}
		if (
			!Number.isInteger(duration) ||
			duration <= 0 ||
			duration > settings.sessionMinutes ||
			start < Date.parse(schedule.createdAt)
		)
			errors.push("Invalid session duration or start.");
		if (
			i &&
			start < Date.parse(sessions[i - 1].end) + settings.breakMinutes * minute
		)
			errors.push("Sessions overlap or omit a required break.");
		if (!slots.some((w) => start >= w.start && end <= w.end))
			errors.push("Session lies outside availability.");
		if (dateAt(end - 1, settings.timezone) > t.goal.targetDate)
			errors.push("Session exceeds its deadline.");
		effort.set(t.id, (effort.get(t.id) ?? 0) + duration);
		const group = grouped.get(t.id);
		if (group) group.push(s);
		else grouped.set(t.id, [s]);
		const key = t.goal.id + ":" + weekOf(dateAt(start, settings.timezone));
		weekly.set(key, (weekly.get(key) ?? 0) + duration);
		if (weekly.get(key)! > t.goal.weeklyHours * 60)
			errors.push("Goal weekly budget exceeded.");
	}
	const remainders = new Map(
		schedule.unscheduled.map((t) => [t.taskId, t.remainingMinutes]),
	);
	for (const x of schedule.unscheduled)
		if (!byId.has(x.taskId) || byId.get(x.taskId)?.completed)
			errors.push("Unscheduled work references missing or completed tasks.");
	for (const t of tasks) {
		const allocated = effort.get(t.id) ?? 0;
		if (!t.completed && allocated + (remainders.get(t.id) ?? 0) !== t.minutes)
			errors.push("Task effort is missing or overallocated.");
		const first = grouped.get(t.id)?.[0];
		if (first)
			for (const id of t.dependsOn ?? []) {
				const parent = byId.get(id),
					parentSessions = grouped.get(id);
				if (
					!parent ||
					(!parent.completed &&
						((effort.get(id) ?? 0) !== parent.minutes ||
							!parentSessions?.length ||
							Date.parse(parentSessions[parentSessions.length - 1].end) >
								Date.parse(first.start)))
				)
					errors.push("Dependency order violated.");
			}
	}
	return [...new Set(errors)];
}
export function scheduleDiff(previous: Schedule | undefined, next: Schedule) {
	const group = (sessions: Session[]) => {
		const map = new Map<string, Session[]>();
		for (const s of sessions) {
			const list = map.get(s.taskId);
			if (list) list.push(s);
			else map.set(s.taskId, [s]);
		}
		return map;
	};
	const beforeMap = group(previous?.sessions ?? []),
		afterMap = group(next.sessions);
	return [...new Set([...beforeMap.keys(), ...afterMap.keys()])].flatMap(
		(taskId) => {
			const before = beforeMap.get(taskId) ?? [],
				after = afterMap.get(taskId) ?? [];
			return JSON.stringify(before) === JSON.stringify(after)
				? []
				: [
						{
							taskId,
							title: after[0]?.title ?? before[0]?.title ?? taskId,
							before,
							after,
						},
					];
		},
	);
}
