import test from "node:test";
import assert from "node:assert/strict";
import {
	generateSchedule,
	scheduleViolations,
	inputRevision,
	scheduleDiff,
} from "../src/frontend/src/planner/scheduler.ts";
import { wallInstant } from "../src/frontend/src/planner/time.ts";
import { validWorkspace } from "../src/frontend/src/planner/model.ts";
import type { Workspace } from "../src/frontend/src/planner/model.ts";
import type { ScheduleSettings } from "../src/frontend/src/planner/schedule-types.ts";
const now = "2026-10-26T08:00:00.000Z";
function fixture(): { workspace: Workspace; settings: ScheduleSettings } {
	return {
		workspace: {
			version: 1,
			items: [],
			goals: [
				{
					id: "goal",
					title: "Project",
					description: "",
					constraints: "",
					color: "forest",
					weeklyHours: 4,
					targetDate: "2026-11-09",
					milestones: [
						{
							id: "m",
							title: "Build",
							tasks: [
								{ id: "a", title: "Design", minutes: 60, completed: false },
								{
									id: "b",
									title: "Build",
									minutes: 90,
									completed: false,
									dependsOn: ["a"],
								},
							],
						},
					],
				},
			],
		},
		settings: {
			timezone: "UTC",
			horizonDays: 14,
			sessionMinutes: 60,
			breakMinutes: 10,
			windows: [{ id: "w", weekday: 1, start: "09:00", end: "12:00" }],
			commitments: [],
		},
	};
}
test("schedule is deterministic, respects dependencies, splits effort, and does not mutate inputs", () => {
	const { workspace, settings } = fixture(),
		before = JSON.stringify({ workspace, settings });
	const a = generateSchedule(workspace, settings, now),
		b = generateSchedule(workspace, settings, now);
	assert.deepEqual(a, b);
	assert.equal(JSON.stringify({ workspace, settings }), before);
	assert.deepEqual(scheduleViolations(workspace, settings, a), []);
	assert.equal(a.sessions.length, 3);
	assert.equal(a.unscheduled.length, 0);
	assert.equal(a.sessions[1].start, "2026-10-26T10:10:00.000Z");
});
test("fixed commitments subtract time, and actual availability is shared across goals", () => {
	const { workspace, settings } = fixture();
	settings.commitments = [
		{
			id: "c",
			date: "2026-10-26",
			start: "10:00",
			end: "11:00",
			title: "Class",
		},
	];
	workspace.goals.push({
		...workspace.goals[0],
		id: "other",
		milestones: [
			{
				id: "m2",
				title: "Other",
				tasks: [
					{ id: "x", title: "Other work", minutes: 120, completed: false },
				],
			},
		],
	});
	const result = generateSchedule(workspace, settings, now);
	assert.deepEqual(scheduleViolations(workspace, settings, result), []);
	assert.ok(
		result.sessions.every(
			(s) =>
				s.start >= "2026-10-26T11:00:00.000Z" ||
				s.end <= "2026-10-26T10:00:00.000Z",
		),
	);
});
test("expired deadlines and dependent tasks explain unscheduled effort", () => {
	const { workspace, settings } = fixture();
	workspace.goals[0].targetDate = "2026-10-25";
	const result = generateSchedule(workspace, settings, now);
	assert.equal(result.sessions.length, 0);
	assert.deepEqual(
		result.unscheduled.map((t) => t.reason),
		["DEADLINE_PASSED", "DEPENDENCY_BLOCKED"],
	);
});
test("weekly goal budget remains a cap even when more availability exists", () => {
	const { workspace, settings } = fixture();
	workspace.goals[0].weeklyHours = 0.5;
	const result = generateSchedule(workspace, settings, now);
	assert.equal(
		result.sessions.reduce(
			(sum, s) => sum + (Date.parse(s.end) - Date.parse(s.start)) / 60000,
			0,
		),
		60,
	);
	assert.equal(result.unscheduled[0].taskId, "b");
	assert.equal(result.unscheduled[0].remainingMinutes, 90);
});
test("cycles, dangling dependencies, overlapping windows, and invalid timezones fail before scheduling", () => {
	const { workspace, settings } = fixture();
	workspace.goals[0].milestones[0].tasks[0].dependsOn = ["b"];
	assert.equal(validWorkspace(workspace), false);
	assert.throws(() => generateSchedule(workspace, settings, now), /cycle/);
	workspace.goals[0].milestones[0].tasks[0].dependsOn = ["missing"];
	assert.equal(validWorkspace(workspace), false);
	delete workspace.goals[0].milestones[0].tasks[0].dependsOn;
	assert.throws(
		() =>
			generateSchedule(
				workspace,
				{ ...settings, timezone: "Invalid/Timezone" },
				now,
			),
		/timezone/,
	);
	assert.throws(
		() =>
			generateSchedule(
				workspace,
				{
					...settings,
					windows: [
						...settings.windows,
						{ id: "w2", weekday: 1, start: "10:00", end: "11:00" },
					],
				},
				now,
			),
		/overlap/,
	);
});
test("DST gaps are rejected and repeated wall times choose the earlier instant", () => {
	assert.equal(wallInstant("2026-03-08", "02:30", "America/Chicago"), null);
	assert.equal(
		new Date(
			wallInstant("2026-11-01", "01:30", "America/Chicago")!,
		).toISOString(),
		"2026-11-01T06:30:00.000Z",
	);
	assert.equal(
		new Date(wallInstant("2026-10-26", "19:00", "Asia/Kolkata")!).toISOString(),
		"2026-10-26T13:30:00.000Z",
	);
});
test("independent validation rejects manipulated schedules and stale revisions differ", () => {
	const { workspace, settings } = fixture();
	const result = generateSchedule(workspace, settings, now);
	const altered = structuredClone(result);
	altered.sessions[1].start = altered.sessions[0].start;
	assert.ok(scheduleViolations(workspace, settings, altered).length);
	workspace.goals[0].title = "Changed";
	assert.notEqual(result.inputRevision, inputRevision(workspace, settings));
	assert.equal(scheduleDiff(result, result).length, 0);
	assert.ok(scheduleDiff(undefined, result).length);
});
test("generated randomized DAG fixtures preserve invariants across competing goals", () => {
	let seed = 314;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	for (let run = 0; run < 30; run++) {
		const { workspace, settings } = fixture();
		workspace.goals[0].milestones[0].tasks = Array.from(
			{ length: 20 },
			(_, i) => ({
				id: `task-${i}`,
				title: `Task ${i}`,
				minutes: 5 + Math.floor(random() * 24) * 5,
				completed: random() < 0.15,
				dependsOn:
					i > 0 && random() < 0.5 ? [`task-${Math.floor(random() * i)}`] : [],
			}),
		);
		const result = generateSchedule(workspace, settings, now);
		assert.deepEqual(scheduleViolations(workspace, settings, result), []);
	}
});
