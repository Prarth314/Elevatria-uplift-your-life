import test from "node:test";
import assert from "node:assert/strict";
import {
	allocationSummary,
	placementFacts,
	unplacedExplanation,
} from "../src/frontend/src/planner/explanations.ts";
import {
	generateSchedule,
	scheduleViolations,
} from "../src/frontend/src/planner/scheduler.ts";
import { defaultSettings } from "../src/frontend/src/planner/schedule-types.ts";
import type { Workspace } from "../src/frontend/src/planner/model.ts";
const now = "2026-10-26T08:00:00.000Z";
function fixture() {
	const workspace: Workspace = {
		version: 1,
		items: [],
		goals: [
			{
				id: "g",
				title: "Synthetic",
				description: "",
				constraints: "No Friday work (notes only)",
				color: "forest",
				weeklyHours: 1,
				targetDate: "2026-10-26",
				milestones: [
					{
						id: "m",
						title: "Build",
						tasks: [{ id: "a", title: "A", minutes: 90, completed: false }],
					},
				],
			},
		],
	};
	const settings = {
		...defaultSettings(),
		timezone: "UTC",
		horizonDays: 1,
		windows: [{ id: "w", weekday: 1, start: "09:00", end: "12:00" }],
	};
	return { workspace, settings };
}
test("explanations distinguish proven no-window contradictions from unplaced heuristic work", () => {
	const { workspace, settings } = fixture();
	const schedule = generateSchedule(workspace, settings, now);
	assert.equal(
		unplacedExplanation(workspace, settings, schedule, schedule.unscheduled[0])
			.kind,
		"heuristic",
	);
	assert.match(
		placementFacts(workspace, settings, schedule, schedule.sessions[0]).join(
			" ",
		),
		/09:00–12:00/,
	);
	assert.equal(
		placementFacts(workspace, settings, schedule, schedule.sessions[0]).some(
			(x) => x.includes("Friday"),
		),
		false,
	);
	const emptySettings = { ...settings, windows: [] };
	const empty = generateSchedule(workspace, emptySettings, now);
	assert.equal(
		unplacedExplanation(workspace, emptySettings, empty, empty.unscheduled[0])
			.kind,
		"proven",
	);
});
test("allocation comparison ignores titles/IDs and distinguishes retained, resized, new and removed work", () => {
	const { workspace, settings } = fixture();
	const schedule = generateSchedule(workspace, settings, now);
	const same = structuredClone(schedule);
	same.sessions[0].title = "Renamed";
	same.sessions[0].id = "new-id";
	assert.equal(allocationSummary(schedule, same).retained, 1);
	same.sessions[0].end = "2026-10-26T09:30:00.000Z";
	assert.equal(allocationSummary(schedule, same).changedTasks, 1);
	assert.equal(
		allocationSummary(schedule, { ...same, sessions: [] }).removed,
		1,
	);
	assert.equal(allocationSummary(undefined, schedule).added, 1);
});

/** Independent bounded reference: equal 30m jobs, 3 discrete slots, no splitting or breaks.
 * Enumerates every task/idle assignment; never calls the production generator/validator.
 */
function exhaustive(
	deadlines: number[],
	parents: number[][],
	slotCount: number,
): number {
	let best = 0;
	function visit(slot: number, done: Set<number>) {
		best = Math.max(best, done.size);
		if (slot === slotCount) return;
		visit(slot + 1, done);
		for (let job = 0; job < deadlines.length; job++)
			if (
				!done.has(job) &&
				slot <= deadlines[job] &&
				parents[job].every((p) => done.has(p))
			) {
				done.add(job);
				visit(slot + 1, done);
				done.delete(job);
			}
	}
	visit(0, new Set());
	return best;
}
test("bounded independent exhaustive reference exposes the EDF cross-goal prerequisite limitation", () => {
	const { workspace, settings } = fixture();
	workspace.goals = ["2026-10-27", "2026-10-28", "2026-10-26"].map(
		(deadline, i) => ({
			...workspace.goals[0],
			id: `g${i}`,
			weeklyHours: 4,
			targetDate: deadline,
			milestones: [
				{
					id: `m${i}`,
					title: "M",
					tasks: [
						{
							id: `t${i}`,
							title: `Task ${i}`,
							minutes: 30,
							completed: false,
							dependsOn: i === 2 ? ["t1"] : [],
						},
					],
				},
			],
		}),
	);
	const windows = [
		{ id: "mon", weekday: 1, start: "09:00", end: "10:00" },
		{ id: "tue", weekday: 2, start: "09:00", end: "09:30" },
	];
	const config = { ...settings, horizonDays: 3, breakMinutes: 0, windows };
	const result = generateSchedule(workspace, config, now);
	assert.deepEqual(scheduleViolations(workspace, config, result), []);
	assert.equal(exhaustive([2, 2, 1], [[], [], [1]], 3), 3);
	assert.equal(new Set(result.sessions.map((s) => s.taskId)).size, 2);
	assert.equal(result.unscheduled[0].taskId, "t2");
	assert.equal(
		unplacedExplanation(workspace, config, result, result.unscheduled[0]).kind,
		"heuristic",
	);
});
