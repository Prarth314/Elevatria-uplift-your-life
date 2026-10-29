import test from "node:test";
import assert from "node:assert/strict";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";
import {
	generatePlan,
	capacity,
	weeklyFocus,
} from "../src/frontend/src/planner/planning.ts";
import {
	validWorkspace,
	validDate,
	progress,
} from "../src/frontend/src/planner/model.ts";
import {
	loadWorkspace,
	saveWorkspace,
	WORKSPACE_KEY,
} from "../src/frontend/src/planner/persistence.ts";

test("sample and generated plans pass runtime validation, with unique IDs and independent tasks", () => {
	const workspace = sampleWorkspace();
	assert.equal(validWorkspace(workspace), true);
	const goal = workspace.goals[0];
	const old = JSON.stringify(goal);
	const first = generatePlan(goal);
	const second = generatePlan(goal);
	assert.equal(JSON.stringify(goal), old);
	assert.equal(
		validWorkspace({ ...workspace, goals: [{ ...goal, milestones: first }] }),
		true,
	);
	assert.equal(
		first.flatMap((m) => m.tasks).every((t) => !t.completed),
		true,
	);
	assert.notEqual(first[0].tasks[0].id, second[0].tasks[0].id);
	assert.equal(first.length, 3);
});
test("validation rejects malformed dates, invalid effort, duplicate IDs, unsafe images, and dangling links", () => {
	assert.equal(validDate("2026-02-30"), false);
	assert.equal(validDate("2028-02-29"), true);
	for (const mutation of [
		(w: any) => {
			w.goals[0].weeklyHours = Infinity;
		},
		(w: any) => {
			w.goals[0].weeklyHours = 0;
		},
		(w: any) => {
			w.goals[0].milestones[0].tasks[0].minutes = -30;
		},
		(w: any) => {
			w.goals[0].milestones[0].tasks[0].completed = "true";
		},
		(w: any) => {
			w.goals[0].milestones[1].id = w.goals[0].milestones[0].id;
		},
		(w: any) => {
			w.items[0].image = "javascript:alert(1)";
		},
		(w: any) => {
			w.items[0].image = "data:image/svg+xml;base64,anything";
		},
		(w: any) => {
			w.items[0].goalId = "missing";
		},
		(w: any) => {
			w.goals[0].title = "   ";
		},
		(w: any) => {
			w.version = 2;
		},
	]) {
		const w = sampleWorkspace();
		mutation(w);
		assert.equal(validWorkspace(w), false);
	}
});
test("progress weights duration and responds to complete/reopen without changing estimates", () => {
	const goal = sampleWorkspace().goals[0];
	const before = progress(goal);
	assert.deepEqual(
		{ done: before.done, total: before.total, percent: before.percent },
		{ done: 2, total: 9, percent: 13 },
	);
	goal.milestones[0].tasks[2].completed = true;
	assert.equal(progress(goal).done, 3);
	assert.equal(progress(goal).remaining, before.remaining - 45);
	goal.milestones[0].tasks[2].completed = false;
	assert.deepEqual(progress(goal), before);
	goal.milestones.forEach((m) =>
		m.tasks.forEach((t) => {
			t.completed = true;
		}),
	);
	assert.equal(progress(goal).percent, 100);
	assert.equal(progress({ ...goal, milestones: [] }).percent, 0);
});
test("capacity uses remaining effort, inclusive local dates, weekly availability, and overdue deadlines", () => {
	const goal = sampleWorkspace().goals[0];
	goal.weeklyHours = 1;
	goal.targetDate = "2026-11-04";
	const c = capacity(goal, "2026-10-29");
	assert.equal(c.days, 7);
	assert.equal(c.available, 60);
	assert.equal(c.over, true);
	assert.equal(
		capacity({ ...goal, targetDate: "2026-10-28" }, "2026-10-29").available,
		0,
	);
	assert.equal(
		capacity({ ...goal, weeklyHours: 20 }, "2026-10-29").over,
		false,
	);
});
test("weekly focus stays within budget and keeps task order instead of skipping oversized work", () => {
	const goal = sampleWorkspace().goals[0];
	goal.weeklyHours = 1;
	const focus = weeklyFocus(goal);
	assert.equal(focus.length, 1);
	assert.equal(focus[0].minutes, 45);
	assert.ok(focus.reduce((sum, task) => sum + task.minutes, 0) <= 60);
	assert.equal(weeklyFocus({ ...goal, weeklyHours: 0.5 }).length, 0);
});
test("persistence round-trips edits, completion and images in the dedicated demo key", () => {
	const values = new Map<string, string>([["legacy-user-data", "untouched"]]);
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};
	assert.deepEqual(loadWorkspace(storage), { status: "empty" });
	const workspace = sampleWorkspace();
	workspace.goals[0].title = "Edited goal";
	workspace.items[0].image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrYcAAAAASUVORK5CYII=";
	workspace.goals[0].milestones[0].tasks[2].completed = true;
	assert.equal(saveWorkspace(storage, workspace), null);
	assert.deepEqual(loadWorkspace(storage), { status: "ready", workspace });
	assert.equal(values.get("legacy-user-data"), "untouched");
	assert.ok(values.has(WORKSPACE_KEY));
});
test("corrupt, unavailable, and full storage are visible failures without overwriting data", () => {
	let writes = 0;
	const corrupt = {
		getItem: () => "{broken",
		setItem: () => {
			writes++;
		},
	};
	assert.equal(loadWorkspace(corrupt).status, "error");
	assert.equal(writes, 0);
	const unavailable = {
		getItem: () => {
			throw Error("blocked");
		},
		setItem: () => {
			throw Error("quota");
		},
	};
	assert.equal(loadWorkspace(unavailable).status, "error");
	assert.match(
		saveWorkspace(unavailable, sampleWorkspace())!,
		/in memory only/,
	);
	const invalid = sampleWorkspace();
	invalid.goals[0].title = "";
	assert.match(saveWorkspace(corrupt, invalid)!, /invalid/);
	assert.equal(writes, 0);
});
