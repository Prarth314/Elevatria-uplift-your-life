import type { Workspace } from "./model.ts";
export function dependencyErrors(workspace: Workspace): string[] {
	const tasks = workspace.goals.flatMap((g) =>
		g.milestones.flatMap((m) => m.tasks),
	);
	const byId = new Map(tasks.map((t) => [t.id, t]));
	const incoming = new Map(
		tasks.map((t) => [t.id, (t.dependsOn ?? []).length]),
	);
	const children = new Map<string, string[]>();
	for (const t of tasks) {
		if (
			!Array.isArray(t.dependsOn ?? []) ||
			new Set(t.dependsOn).size !== (t.dependsOn ?? []).length ||
			(t.dependsOn ?? []).some((id) => id === t.id || !byId.has(id))
		)
			return [
				"Dependencies must reference distinct existing tasks and cannot reference the task itself.",
			];
		for (const id of t.dependsOn ?? [])
			children.set(id, [...(children.get(id) ?? []), t.id]);
	}
	const ready = tasks.filter((t) => !incoming.get(t.id)).map((t) => t.id);
	let visited = 0;
	for (let i = 0; i < ready.length; i++) {
		visited++;
		for (const id of children.get(ready[i]) ?? []) {
			incoming.set(id, incoming.get(id)! - 1);
			if (!incoming.get(id)) ready.push(id);
		}
	}
	return visited === tasks.length
		? []
		: [
				"The dependency graph contains a cycle. Remove a dependency before saving.",
			];
}
