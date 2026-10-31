import test from "node:test";
import assert from "node:assert/strict";
import {
	generateSchedule,
	scheduleViolations,
	scheduleDiff,
} from "../src/frontend/src/planner/scheduler.ts";
import { repairSchedule } from "../src/frontend/src/planner/recovery.ts";
import type { Workspace } from "../src/frontend/src/planner/model.ts";
import type { ScheduleSettings } from "../src/frontend/src/planner/schedule-types.ts";
const now = "2026-11-02T08:00:00.000Z";
test("Recovery retains feasible existing placements that a fresh earliest-deadline run would move", () => {
	const { workspace, settings, previous } = setup();
	previous.sessions = previous.sessions.map((s) => ({
		...s,
		start: new Date(Date.parse(s.start) + 86400000).toISOString(),
		end: new Date(Date.parse(s.end) + 86400000).toISOString(),
	}));
	assert.deepEqual(scheduleViolations(workspace, settings, previous), []);
	const fresh = generateSchedule(workspace, settings, now),
		repaired = repairSchedule(
			workspace,
			settings,
			{ previous, protectedTaskIds: [] },
			now,
		);
	assert.ok(
		scheduleDiff(previous, repaired).length <
			scheduleDiff(previous, fresh).length,
	);
	assert.deepEqual(scheduleViolations(workspace, settings, repaired), []);
});
function setup() {
	const workspace: Workspace = {
		version: 1,
		items: [],
		goals: [
			{
				id: "goal",
				title: "Ship",
				description: "",
				constraints: "",
				color: "forest",
				targetDate: "2026-11-08",
				weeklyHours: 8,
				milestones: [
					{
						id: "milestone",
						title: "Build",
						tasks: [
							{ id: "a", title: "Design", minutes: 60, completed: false },
							{
								id: "b",
								title: "Implement",
								minutes: 60,
								completed: false,
								dependsOn: ["a"],
							},
							{ id: "c", title: "Independent", minutes: 60, completed: false },
						],
					},
				],
			},
		],
	};
	const settings: ScheduleSettings = {
		timezone: "UTC",
		horizonDays: 7,
		sessionMinutes: 60,
		breakMinutes: 10,
		windows: [
			{ id: "monday", weekday: 1, start: "09:00", end: "14:00" },
			{ id: "tuesday", weekday: 2, start: "09:00", end: "14:00" },
		],
		commitments: [],
	};
	return {
		workspace,
		settings,
		previous: generateSchedule(workspace, settings, now),
	};
}
test("Recovery retains unchanged allocations, is deterministic, and never mutates the accepted input", () => {
	const { workspace, settings, previous } = setup(),
		snapshot = JSON.stringify({ workspace, settings, previous });
	const options = { previous, protectedTaskIds: [] };
	const repaired = repairSchedule(workspace, settings, options, now);
	assert.equal(scheduleDiff(previous, repaired).length, 0);
	assert.deepEqual(repaired, repairSchedule(workspace, settings, options, now));
	assert.equal(JSON.stringify({ workspace, settings, previous }), snapshot);
});
test("Protected sessions reserve capacity before other work; conflicting protection fails visibly", () => {
	const { workspace, settings, previous } = setup();
	const changed = {
		...settings,
		commitments: [
			{
				id: "appointment",
				title: "Appointment",
				date: "2026-11-02",
				start: "09:00",
				end: "10:00",
			},
		],
	};
	const repaired = repairSchedule(
		workspace,
		changed,
		{ previous, protectedTaskIds: ["c"] },
		now,
	);
	assert.deepEqual(
		repaired.sessions.filter((s) => s.taskId === "c"),
		previous.sessions.filter((s) => s.taskId === "c"),
	);
	assert.deepEqual(scheduleViolations(workspace, changed, repaired), []);
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				changed,
				{ previous, protectedTaskIds: ["a"] },
				now,
			),
		/protected session/i,
	);
});
test("Missed work remains unfinished; past, completed and re-estimated allocations cannot be protected", () => {
	const { workspace, settings, previous } = setup();
	const later = "2026-11-02T10:15:00.000Z";
	const repaired = repairSchedule(
		workspace,
		settings,
		{ previous, protectedTaskIds: [] },
		later,
	);
	assert.ok(repaired.sessions.every((s) => s.start >= later));
	assert.ok(workspace.goals[0].milestones[0].tasks.every((t) => !t.completed));
	assert.deepEqual(scheduleViolations(workspace, settings, repaired), []);
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				settings,
				{ previous, protectedTaskIds: ["a"] },
				later,
			),
		/past/,
	);
	workspace.goals[0].milestones[0].tasks[0].minutes = 90;
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				settings,
				{ previous, protectedTaskIds: ["a"] },
				now,
			),
		/duration/,
	);
	workspace.goals[0].milestones[0].tasks[0].completed = true;
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				settings,
				{ previous, protectedTaskIds: ["a"] },
				now,
			),
		/completed/,
	);
});
test("Recovery respects reduced budgets and reports unplaced effort without overbooking", () => {
	const { workspace, settings, previous } = setup();
	workspace.goals[0].weeklyHours = 0.5;
	const repaired = repairSchedule(
		workspace,
		settings,
		{ previous, protectedTaskIds: [] },
		now,
	);
	assert.ok(repaired.unscheduled.length);
	assert.deepEqual(scheduleViolations(workspace, settings, repaired), []);
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				settings,
				{ previous, protectedTaskIds: ["c"] },
				now,
			),
		/budget/,
	);
});
test("Protection cannot violate prerequisites, deadlines, or unrecognized recovery input", () => {
	const { workspace, settings, previous } = setup();
	workspace.goals[0].milestones[0].tasks[0].minutes = 180;
	assert.throws(
		() =>
			repairSchedule(
				workspace,
				settings,
				{ previous, protectedTaskIds: ["b"] },
				now,
			),
		/prerequisite/,
	);
	const original = setup();
	original.workspace.goals[0].targetDate = "2026-11-01";
	assert.throws(
		() =>
			repairSchedule(
				original.workspace,
				original.settings,
				{ previous: original.previous, protectedTaskIds: ["a"] },
				now,
			),
		/deadline/,
	);
	assert.throws(
		() =>
			repairSchedule(
				original.workspace,
				original.settings,
				{ previous: original.previous, protectedTaskIds: ["missing"] },
				now,
			),
		/missing/,
	);
	assert.throws(
		() =>
			repairSchedule(
				original.workspace,
				original.settings,
				{
					previous: original.previous,
					protectedTaskIds: [],
					hidden: true,
				} as any,
				now,
			),
		/invalid/,
	);
});
