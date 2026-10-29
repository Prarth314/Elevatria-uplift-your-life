import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import {
	generateSchedule,
	scheduleViolations,
} from "../src/frontend/src/planner/scheduler.ts";
import type { Workspace, Task } from "../src/frontend/src/planner/model.ts";
import type { ScheduleSettings } from "../src/frontend/src/planner/schedule-types.ts";
const settings: ScheduleSettings = {
	timezone: "UTC",
	horizonDays: 56,
	sessionMinutes: 60,
	breakMinutes: 10,
	windows: [1, 2, 3, 4, 5].map((day) => ({
		id: `w${day}`,
		weekday: day,
		start: "09:00",
		end: "18:00",
	})),
	commitments: [],
};
const results = [];
for (const count of [100, 300, 1000]) {
	const tasks: Task[] = Array.from({ length: count }, (_, i) => ({
		id: `task-${i}`,
		title: `Benchmark task ${i}`,
		minutes: 30 + (i % 4) * 15,
		completed: false,
		dependsOn: i % 10 === 0 ? [] : [`task-${i - 1}`],
	}));
	const workspace: Workspace = {
		version: 1,
		items: [],
		goals: [
			{
				id: "goal",
				title: "Benchmark",
				description: "",
				constraints: "",
				color: "forest",
				weeklyHours: 40,
				targetDate: "2026-12-20",
				milestones: Array.from({ length: Math.ceil(count / 100) }, (_, i) => ({
					id: `m${i}`,
					title: "Benchmark milestone",
					tasks: tasks.slice(i * 100, (i + 1) * 100),
				})),
			},
		],
	};
	const elapsed = [];
	let sessions = 0,
		unscheduled = 0;
	for (let run = 0; run < 3; run++) {
		const start = performance.now();
		const schedule = generateSchedule(
			workspace,
			settings,
			"2026-10-26T08:00:00.000Z",
		);
		elapsed.push(performance.now() - start);
		if (scheduleViolations(workspace, settings, schedule).length)
			throw Error("Benchmark produced an invalid schedule.");
		sessions = schedule.sessions.length;
		unscheduled = schedule.unscheduled.length;
	}
	elapsed.sort((a, b) => a - b);
	results.push({
		tasks: count,
		runs: 3,
		medianMs: Math.round(elapsed[1] * 100) / 100,
		maxMs: Math.round(elapsed[2] * 100) / 100,
		sessions,
		unscheduledTasks: unscheduled,
	});
}
const report = {
	node: process.version,
	platform: process.platform,
	architecture: process.arch,
	algorithm: "earliest-deadline-v1",
	note: "Synthetic single-machine observations, not a production latency guarantee. Browser execution uses a cancellable five-second worker.",
	results,
};
await writeFile(
	new URL("../artifacts/scheduling-benchmark.json", import.meta.url),
	JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
