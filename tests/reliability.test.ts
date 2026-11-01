import test from "node:test";
import assert from "node:assert/strict";
import { workerRequest } from "../src/frontend/src/planner/worker-transport.ts";
import type {
	WorkerPort,
	WorkerClock,
} from "../src/frontend/src/planner/worker-transport.ts";
import { decodeSchedule } from "../src/frontend/src/planner/worker-client.ts";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";
import { defaultSettings } from "../src/frontend/src/planner/schedule-types.ts";
import { generateSchedule } from "../src/frontend/src/planner/scheduler.ts";
import { proposalErrors } from "../src/frontend/src/planner/proposals.ts";
import {
	guardedStorage,
	loadWorkspace,
	saveWorkspace,
	WORKSPACE_KEY,
	saveCoordinatedLocalWorkspace,
} from "../src/frontend/src/planner/persistence.ts";
import type { WriteLock } from "../src/frontend/src/planner/persistence.ts";
const now = "2026-10-26T08:00:00.000Z";
function fixture() {
	const workspace = sampleWorkspace();
	workspace.goals[0].targetDate = "2026-12-01";
	const settings = {
		...defaultSettings(),
		timezone: "UTC",
		windows: [{ id: "w", weekday: 1, start: "09:00", end: "18:00" }],
	};
	return {
		workspace,
		settings,
		schedule: generateSchedule(workspace, settings, now),
	};
}
function transport() {
	let terminated = 0,
		cleared = 0,
		expire = () => {},
		sent: unknown;
	const worker: WorkerPort = {
		onmessage: null,
		onerror: null,
		onmessageerror: null,
		postMessage(value) {
			sent = value;
		},
		terminate() {
			terminated++;
		},
	};
	const clock: WorkerClock = {
		start(callback, ms) {
			assert.equal(ms, 5000);
			expire = callback;
			return 1;
		},
		clear() {
			cleared++;
		},
	};
	return {
		worker,
		clock,
		expire: () => expire(),
		stats: () => ({ terminated, cleared, sent }),
	};
}
test("worker cancellation rejects queued stale messages, cleans up exactly once, and permits a fresh request", async () => {
	const fake = transport(),
		controller = new AbortController();
	const promise = workerRequest(
		() => fake.worker,
		{ synthetic: true },
		controller.signal,
		(x) => x,
		fake.clock,
	);
	const queued = fake.worker.onmessage!;
	controller.abort();
	queued({ data: "late" } as MessageEvent);
	await assert.rejects(promise, { name: "AbortError" });
	fake.expire();
	assert.equal(fake.stats().terminated, 1);
	assert.equal(fake.worker.onmessage, null);
	const fresh = transport();
	const restarted = workerRequest(
		() => fresh.worker,
		null,
		new AbortController().signal,
		(x) => x,
		fresh.clock,
	);
	fresh.worker.onmessage!({ data: "fresh" } as MessageEvent);
	assert.equal(await restarted, "fresh");
	assert.equal(fresh.stats().terminated, 1);
});
test("worker timeout, error, message decoding, postMessage and constructor failures preserve a retry path", async () => {
	for (const kind of [
		"timeout",
		"error",
		"messageerror",
		"decode",
		"post",
	] as const) {
		const fake = transport();
		if (kind === "post")
			fake.worker.postMessage = () => {
				throw Error("clone");
			};
		const result = workerRequest(
			() => fake.worker,
			null,
			new AbortController().signal,
			() => {
				throw Error("invalid reply");
			},
			fake.clock,
		);
		if (kind === "timeout") fake.expire();
		if (kind === "error") fake.worker.onerror!({} as ErrorEvent);
		if (kind === "messageerror")
			fake.worker.onmessageerror!({} as MessageEvent);
		if (kind === "decode") fake.worker.onmessage!({ data: {} } as MessageEvent);
		await assert.rejects(result, /limit|failed|invalid reply|could not start/);
		assert.equal(fake.stats().terminated, 1);
	}
	await assert.rejects(
		workerRequest(
			() => {
				throw Error("CSP");
			},
			null,
			new AbortController().signal,
			(x) => x,
		),
		/could not start/,
	);
	let created = false;
	const cancelled = new AbortController();
	cancelled.abort();
	await assert.rejects(
		workerRequest(
			() => {
				created = true;
				return transport().worker;
			},
			null,
			cancelled.signal,
			(x) => x,
		),
		{ name: "AbortError" },
	);
	assert.equal(created, false);
});
test("worker reply and acceptance boundaries reject stale, malformed and constraint-violating proposals", () => {
	const { workspace, settings, schedule } = fixture();
	assert.deepEqual(decodeSchedule(workspace, settings, { schedule }), schedule);
	assert.deepEqual(
		proposalErrors(workspace, settings, schedule, Date.parse(now)),
		[],
	);
	assert.match(
		proposalErrors(workspace, settings, schedule, Date.parse("2027-01-01"))[0],
		/past/,
	);
	const bad = structuredClone(schedule);
	bad.sessions[0].end = bad.sessions[0].start;
	assert.throws(
		() => decodeSchedule(workspace, settings, { schedule: bad }),
		/invalid/,
	);
	for (const mutate of [
		(w: typeof workspace) => {
			w.goals[0].weeklyHours = 1;
		},
		(w: typeof workspace) => {
			w.goals[0].targetDate = "2026-10-27";
		},
		(w: typeof workspace) => {
			w.goals[0].milestones[0].tasks[2].completed = true;
		},
		(w: typeof workspace) => {
			w.goals[0].milestones[0].tasks[0].completed = false;
		},
		(w: typeof workspace) => {
			w.goals[0].milestones[0].tasks[2].minutes += 5;
		},
		(w: typeof workspace) => {
			w.goals[0].milestones[1].tasks[0].dependsOn = [];
		},
	]) {
		const changed = structuredClone(workspace);
		mutate(changed);
		assert.match(
			proposalErrors(changed, settings, schedule, Date.parse(now))[0],
			/stale/,
		);
		assert.throws(
			() => decodeSchedule(changed, settings, { schedule }),
			/stale/,
		);
	}
});
test("guarded persistence rejects a second tab even before its storage event; quota failure leaves saved data recoverable", () => {
	const values = new Map<string, string>();
	let fail = false;
	const underlying = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem(key: string, value: string) {
			if (fail) throw Error("quota");
			values.set(key, value);
		},
	};
	const a = guardedStorage(underlying),
		b = guardedStorage(underlying);
	loadWorkspace(a);
	loadWorkspace(b);
	const original = sampleWorkspace();
	assert.equal(saveWorkspace(a, original), null);
	const newer = structuredClone(original);
	newer.goals[0].title = "Synthetic newer board";
	assert.match(saveWorkspace(b, newer)!, /another tab/);
	assert.deepEqual(loadWorkspace(b), { status: "ready", workspace: original });
	assert.equal(saveWorkspace(b, newer), null);
	assert.match(saveWorkspace(a, original)!, /another tab/);
	loadWorkspace(a);
	fail = true;
	assert.match(saveWorkspace(a, original)!, /in memory/);
	assert.equal(
		JSON.parse(values.get(WORKSPACE_KEY)!).goals[0].title,
		newer.goals[0].title,
	);
	fail = false;
	assert.equal(saveWorkspace(a, original), null);
	assert.deepEqual(loadWorkspace(a), { status: "ready", workspace: original });
});
test("reload preserves only accepted state, not an unaccepted proposal or session-only undo", () => {
	const { workspace, settings, schedule } = fixture();
	workspace.planning = { settings, accepted: schedule, history: [] };
	const values = new Map<string, string>();
	const storage = guardedStorage({
		getItem: (k) => values.get(k) ?? null,
		setItem: (k, v) => {
			values.set(k, v);
		},
	});
	loadWorkspace(storage);
	saveWorkspace(storage, workspace);
	const changed = structuredClone(workspace);
	changed.goals[0].weeklyHours = 0.5;
	const unaccepted = generateSchedule(changed, settings, now);
	assert.notDeepEqual(unaccepted, schedule);
	assert.deepEqual(loadWorkspace(storage), { status: "ready", workspace });
});

test("coordinated concurrent tab saves serialize comparison/write and preserve the winning board", async () => {
	let raw: string | null = null;
	const storage = {
		getItem: () => raw,
		setItem: (_: string, value: string) => {
			raw = value;
		},
	};
	const a = guardedStorage(storage),
		b = guardedStorage(storage);
	loadWorkspace(a);
	loadWorkspace(b);
	let tail: Promise<unknown> = Promise.resolve();
	const lock: WriteLock = {
		request(_name, operation) {
			assert.equal(_name, WORKSPACE_KEY);
			const result = tail.then(operation);
			tail = result.catch(() => {});
			return result;
		},
	};
	const first = sampleWorkspace(),
		second = structuredClone(first);
	second.goals[0].title = "Concurrent synthetic board";
	const results = await Promise.all([
		saveCoordinatedLocalWorkspace(a, first, null, lock, () => true),
		saveCoordinatedLocalWorkspace(b, second, null, lock, () => true),
	]);
	assert.equal(results[0], null);
	assert.match(results[1]!, /another tab/);
	assert.deepEqual(loadWorkspace(a), { status: "ready", workspace: first });
	// Explicit replacement adopts the latest baseline only within the lock.
	assert.equal(
		await saveCoordinatedLocalWorkspace(
			b,
			second,
			null,
			lock,
			() => true,
			true,
		),
		null,
	);
	assert.deepEqual(loadWorkspace(b), { status: "ready", workspace: second });
});

test("queued obsolete/account saves never write and unavailable coordination fails safely", async () => {
	let writes = 0,
		acquisitions = 0;
	const storage = guardedStorage({
		getItem: () => null,
		setItem() {
			writes++;
		},
	});
	loadWorkspace(storage);
	const lock: WriteLock = {
		async request(_name, operation) {
			acquisitions++;
			await Promise.resolve();
			return operation();
		},
	};
	const workspace = sampleWorkspace();
	let current = true;
	const obsolete = saveCoordinatedLocalWorkspace(
		storage,
		workspace,
		null,
		lock,
		() => current,
	);
	current = false;
	assert.equal(await obsolete, undefined);
	assert.equal(writes, 0);
	assert.match(
		(await saveCoordinatedLocalWorkspace(
			storage,
			workspace,
			"synthetic-owner",
			lock,
			() => true,
		))!,
		/Account data/,
	);
	assert.equal(acquisitions, 1);
	assert.match(
		(await saveCoordinatedLocalWorkspace(
			storage,
			workspace,
			null,
			undefined,
			() => true,
		))!,
		/in memory/,
	);
	const rejectedLock: WriteLock = {
		async request() {
			throw Error("blocked");
		},
	};
	assert.match(
		(await saveCoordinatedLocalWorkspace(
			storage,
			workspace,
			null,
			rejectedLock,
			() => true,
		))!,
		/Safe browser saving failed/,
	);
	assert.equal(writes, 0);
});
