import type { Workspace, Task } from "../src/frontend/src/planner/model.ts";
import type { ScheduleSettings } from "../src/frontend/src/planner/schedule-types.ts";
export const benchmarkClock = "2026-10-26T08:00:00.000Z";
export const workloadShapes = [
	{
		name: "small-wide",
		tasks: 100,
		goals: 2,
		depth: 5,
		parents: 1,
		horizon: 14,
		windows: 2,
		commitments: 2,
		budget: 8,
	},
	{
		name: "medium-dense",
		tasks: 300,
		goals: 3,
		depth: 20,
		parents: 4,
		horizon: 28,
		windows: 5,
		commitments: 12,
		budget: 12,
	},
	{
		name: "large-deep",
		tasks: 1000,
		goals: 5,
		depth: 100,
		parents: 2,
		horizon: 56,
		windows: 7,
		commitments: 30,
		budget: 20,
	},
] as const;
export function syntheticWorkload(
	shape: (typeof workloadShapes)[number],
	seed = 314,
) {
	let state = seed;
	const random = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
	const tasks: Task[] = Array.from({ length: shape.tasks }, (_, i) => {
		const parents = new Set<string>();
		if (i % shape.depth)
			for (let p = 0; p < shape.parents; p++)
				parents.add(
					`task-${i - 1 - Math.floor(random() * Math.min(i % shape.depth, 8))}`,
				);
		return {
			id: `task-${i}`,
			title: `Synthetic task ${i}`,
			minutes: 15 + Math.floor(random() * 4) * 15,
			completed: false,
			dependsOn: [...parents],
		};
	});
	const workspace: Workspace = {
		version: 1,
		items: [],
		goals: Array.from({ length: shape.goals }, (_, g) => {
			const own = tasks.filter((_, i) => i % shape.goals === g);
			return {
				id: `goal-${g}`,
				title: `Synthetic goal ${g}`,
				description: "",
				constraints: "",
				color: "forest",
				weeklyHours: shape.budget,
				targetDate: ["2026-11-09", "2026-11-23", "2026-12-20"][g % 3],
				milestones: Array.from(
					{ length: Math.ceil(own.length / 100) },
					(_, m) => ({
						id: `m-${g}-${m}`,
						title: "Synthetic milestone",
						tasks: own.slice(m * 100, (m + 1) * 100),
					}),
				),
			};
		}),
	};
	const settings: ScheduleSettings = {
		timezone: "UTC",
		horizonDays: shape.horizon,
		sessionMinutes: 60,
		breakMinutes: 10,
		windows: Array.from({ length: shape.windows }, (_, i) => ({
			id: `w${i}`,
			weekday: i,
			start: "09:00",
			end: "18:00",
		})),
		commitments: Array.from({ length: shape.commitments }, (_, i) => ({
			id: `c${i}`,
			title: "Synthetic class",
			date: new Date(Date.parse("2026-10-26T12:00Z") + i * 86400000)
				.toISOString()
				.slice(0, 10),
			start: "12:00",
			end: "13:00",
		})),
	};
	return { workspace, settings };
}
