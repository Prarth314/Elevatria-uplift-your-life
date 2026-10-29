import type { PlanningState } from "./schedule-types.ts";
import { validPlanning } from "./schedule-validation.ts";
import { dependencyErrors } from "./dependencies.ts";
export interface Task {
	dependsOn?: string[];
	id: string;
	title: string;
	minutes: number;
	completed: boolean;
}
export interface Milestone {
	id: string;
	title: string;
	tasks: Task[];
}
export interface Goal {
	priority?: 1 | 2 | 3;
	category?: "project" | "learning" | "creative" | "custom";
	id: string;
	title: string;
	description: string;
	targetDate: string;
	weeklyHours: number;
	constraints: string;
	color: "forest" | "clay" | "lavender";
	milestones: Milestone[];
}
export interface VisionItem {
	id: string;
	title: string;
	content: string;
	image: string;
	goalId: string;
}
export interface Workspace {
	planning?: PlanningState;
	version: 1;
	goals: Goal[];
	items: VisionItem[];
}
export const newId = () => crypto.randomUUID();
export function localDate(date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateAfter(days: number, now = new Date()): string {
	const date = new Date(now);
	date.setDate(date.getDate() + days);
	return localDate(date);
}
export function validDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
		return false;
	const date = new Date(`${value}T12:00:00`);
	return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function progress(goal: Goal) {
	const tasks = goal.milestones.flatMap((m) => m.tasks);
	const minutes = tasks.reduce((sum, t) => sum + t.minutes, 0);
	const doneMinutes = tasks
		.filter((t) => t.completed)
		.reduce((sum, t) => sum + t.minutes, 0);
	return {
		total: tasks.length,
		done: tasks.filter((t) => t.completed).length,
		minutes,
		remaining: minutes - doneMinutes,
		percent: minutes ? Math.round((doneMinutes / minutes) * 100) : 0,
	};
}
const text = (v: unknown, max = 2000): v is string =>
	typeof v === "string" && v.length <= max;
const title = (v: unknown): v is string => text(v, 160) && v.trim().length > 0;
const record = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === "object" && !Array.isArray(v);
export const safeImage = (v: unknown): v is string =>
	text(v, 1_500_000) &&
	(v === "" ||
		/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v));
export function validWorkspace(value: unknown): value is Workspace {
	if (
		!record(value) ||
		value.version !== 1 ||
		!Array.isArray(value.goals) ||
		!Array.isArray(value.items) ||
		value.goals.length > 100 ||
		value.items.length > 100 ||
		(value.planning !== undefined && !validPlanning(value.planning))
	)
		return false;
	const ids = new Set<string>();
	const unique = (id: unknown) => title(id) && !ids.has(id) && !!ids.add(id);
	for (const g of value.goals) {
		if (
			!record(g) ||
			!unique(g.id) ||
			!title(g.title) ||
			!text(g.description) ||
			!validDate(g.targetDate) ||
			typeof g.weeklyHours !== "number" ||
			!Number.isFinite(g.weeklyHours) ||
			g.weeklyHours < 0.5 ||
			g.weeklyHours > 80 ||
			!text(g.constraints) ||
			!["forest", "clay", "lavender"].includes(String(g.color)) ||
			(g.priority !== undefined && ![1, 2, 3].includes(g.priority as number)) ||
			(g.category !== undefined &&
				!["project", "learning", "creative", "custom"].includes(
					String(g.category),
				)) ||
			!Array.isArray(g.milestones) ||
			g.milestones.length > 30
		)
			return false;
		for (const m of g.milestones) {
			if (
				!record(m) ||
				!unique(m.id) ||
				!title(m.title) ||
				!Array.isArray(m.tasks) ||
				m.tasks.length > 100
			)
				return false;
			for (const t of m.tasks) {
				if (
					!record(t) ||
					!unique(t.id) ||
					!title(t.title) ||
					typeof t.minutes !== "number" ||
					!Number.isInteger(t.minutes) ||
					t.minutes < 5 ||
					t.minutes > 480 ||
					typeof t.completed !== "boolean" ||
					(t.dependsOn !== undefined &&
						(!Array.isArray(t.dependsOn) ||
							t.dependsOn.length > 20 ||
							!t.dependsOn.every(
								(x) => typeof x === "string" && x.length <= 160,
							)))
				)
					return false;
			}
		}
	}
	if (dependencyErrors(value as unknown as Workspace).length) return false;
	const goalIds = new Set(value.goals.map((g) => g.id));
	return value.items.every(
		(i) =>
			record(i) &&
			unique(i.id) &&
			title(i.title) &&
			text(i.content) &&
			safeImage(i.image) &&
			text(i.goalId, 160) &&
			(i.goalId === "" || goalIds.has(i.goalId)),
	);
}
