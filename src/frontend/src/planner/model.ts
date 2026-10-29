import {
	plain,
	identifier,
	boundedText,
	label,
	calendarDate,
	LIMITS,
} from "./structure.ts";
import { safeImage } from "./images.ts";
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
export const validDate = calendarDate;
export { safeImage } from "./images.ts";
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
export function validWorkspace(value: unknown): value is Workspace {
	if (
		!plain(value, ["version", "goals", "items", "planning"]) ||
		value.version !== 1 ||
		!Array.isArray(value.goals) ||
		!Array.isArray(value.items) ||
		value.goals.length > 100 ||
		value.items.length > 100
	)
		return false;
	const ids = new Set<string>();
	let taskCount = 0,
		milestoneCount = 0,
		imageCharacters = 0;
	const unique = (id: unknown) =>
		identifier(id) && !ids.has(id) && !!ids.add(id);
	for (const g of value.goals) {
		if (
			!plain(g, [
				"id",
				"title",
				"description",
				"targetDate",
				"weeklyHours",
				"constraints",
				"color",
				"milestones",
				"priority",
				"category",
			]) ||
			!unique(g.id) ||
			!label(g.title) ||
			!boundedText(g.description) ||
			!calendarDate(g.targetDate) ||
			typeof g.weeklyHours !== "number" ||
			!Number.isFinite(g.weeklyHours) ||
			g.weeklyHours < 0.5 ||
			g.weeklyHours > 80 ||
			!boundedText(g.constraints) ||
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
		milestoneCount += g.milestones.length;
		if (milestoneCount > LIMITS.milestones) return false;
		for (const m of g.milestones) {
			if (
				!plain(m, ["id", "title", "tasks"]) ||
				!unique(m.id) ||
				!label(m.title) ||
				!Array.isArray(m.tasks) ||
				m.tasks.length > 100
			)
				return false;
			taskCount += m.tasks.length;
			if (taskCount > LIMITS.tasks) return false;
			for (const t of m.tasks) {
				if (
					!plain(t, ["id", "title", "minutes", "completed", "dependsOn"]) ||
					!unique(t.id) ||
					!label(t.title) ||
					typeof t.minutes !== "number" ||
					!Number.isInteger(t.minutes) ||
					t.minutes < 5 ||
					t.minutes > 480 ||
					typeof t.completed !== "boolean" ||
					(t.dependsOn !== undefined &&
						(!Array.isArray(t.dependsOn) ||
							t.dependsOn.length > 20 ||
							!t.dependsOn.every(identifier)))
				)
					return false;
			}
		}
	}
	if (dependencyErrors(value as unknown as Workspace).length) return false;
	const goalIds = new Set(value.goals.map((g) => g.id));
	for (const i of value.items) {
		if (
			!plain(i, ["id", "title", "content", "image", "goalId"]) ||
			!unique(i.id) ||
			!label(i.title) ||
			!boundedText(i.content) ||
			typeof i.image !== "string" ||
			i.image.length > LIMITS.imageCharacters ||
			typeof i.goalId !== "string" ||
			(i.goalId !== "" && !goalIds.has(i.goalId))
		)
			return false;
		imageCharacters += i.image.length;
		if (imageCharacters > LIMITS.allImageCharacters || !safeImage(i.image))
			return false;
	}
	return value.planning === undefined || validPlanning(value.planning);
}
