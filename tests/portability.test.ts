import test from "node:test";
import assert from "node:assert/strict";
import {
	parseBackup,
	calendarFile,
} from "../src/frontend/src/planner/portability.ts";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";
import type { Schedule } from "../src/frontend/src/planner/schedule-types.ts";
test("backups round-trip legacy data; invalid imports and unsupported versions are rejected", () => {
	const w = sampleWorkspace();
	assert.deepEqual(parseBackup(JSON.stringify(w)), w);
	assert.throws(() => parseBackup("{broken"), /JSON/);
	assert.throws(
		() => parseBackup(JSON.stringify({ ...w, version: 99 })),
		/version/,
	);
	assert.throws(() => parseBackup("x".repeat(8_000_001)), /8 MB/);
	w.goals[0].milestones[0].tasks[0].dependsOn = ["missing"];
	assert.throws(() => parseBackup(JSON.stringify(w)), /dependencies/);
});
test("calendar export escapes event injection, folds UTF-8 lines, and uses stable occurrence UIDs", () => {
	const schedule: Schedule = {
		id: "s",
		inputRevision: "r",
		algorithm: "earliest-deadline-v1",
		createdAt: "2026-10-29T10:00:00.000Z",
		sessions: [
			{
				id: "slot",
				taskId: "task",
				goalId: "g",
				title: "Read, test; build\\share\nBEGIN:VEVENT " + "🌿".repeat(50),
				start: "2026-10-30T10:00:00.000Z",
				end: "2026-10-30T11:00:00.000Z",
			},
		],
		unscheduled: [],
		warnings: [],
	};
	const a = calendarFile(schedule, schedule.createdAt);
	assert.equal(a.match(/\r\nBEGIN:VEVENT\r\n/g)?.length, 1);
	assert.match(a, /Read\\, test\\; build\\\\share\\nBEGIN:VEVENT/);
	assert.ok(
		a
			.split("\r\n")
			.every((line) => new TextEncoder().encode(line).length <= 75),
	);
	assert.match(a, /DTSTART:20261030T100000Z/);
	const next = structuredClone(schedule);
	next.sessions[0].start = "2026-10-31T10:00:00.000Z";
	next.sessions[0].end = "2026-10-31T11:00:00.000Z";
	assert.equal(
		a.match(/UID:[^\r]+/)?.[0],
		calendarFile(next).match(/UID:[^\r]+/)?.[0],
	);
});
