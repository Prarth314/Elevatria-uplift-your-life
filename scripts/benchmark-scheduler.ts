import { performance } from "node:perf_hooks";
import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpus, totalmem } from "node:os";
import { Worker } from "node:worker_threads";
import {
	generateSchedule,
	scheduleViolations,
} from "../src/frontend/src/planner/scheduler.ts";
import { repairSchedule } from "../src/frontend/src/planner/recovery.ts";
import { validWorkspace } from "../src/frontend/src/planner/model.ts";
import {
	parseBackup,
	calendarFile,
} from "../src/frontend/src/planner/portability.ts";
import {
	loadWorkspace,
	saveWorkspace,
} from "../src/frontend/src/planner/persistence.ts";
import {
	syntheticWorkload,
	workloadShapes,
	benchmarkClock,
} from "./synthetic-workloads.ts";
const samples = 9,
	warmup = 2;
function distribution(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const round = (n: number) => Math.round(n * 100) / 100;
	return {
		samples: values.length,
		minMs: round(sorted[0]),
		medianMs: round(sorted[Math.floor(sorted.length / 2)]),
		p95Ms: round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
		maxMs: round(sorted.at(-1)!),
	};
}
function measure<T>(operation: () => T) {
	const values: number[] = [];
	let value!: T;
	for (let i = -warmup; i < samples; i++) {
		const start = performance.now();
		value = operation();
		if (i >= 0) values.push(performance.now() - start);
	}
	return { timing: distribution(values), value };
}
async function workerRequest(worker: Worker, payload: unknown) {
	return new Promise<any>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(Error("Benchmark worker exceeded 10 seconds"));
		}, 10000);
		const cleanup = () => {
			clearTimeout(timeout);
			worker.off("message", message);
			worker.off("error", error);
		};
		const message = (result: unknown) => {
			cleanup();
			resolve(result);
		};
		const error = (err: Error) => {
			cleanup();
			reject(err);
		};
		worker.once("message", message);
		worker.once("error", error);
		worker.postMessage(payload);
	});
}
const results = [];
for (const shape of workloadShapes) {
	const { workspace, settings } = syntheticWorkload(shape);
	if (!validWorkspace(workspace)) throw Error("Invalid benchmark fixture");
	const scheduled = measure(() =>
		generateSchedule(workspace, settings, benchmarkClock),
	);
	const schedule = scheduled.value;
	const variant = {
		...workspace,
		goals: workspace.goals.map((g) => ({
			...g,
			weeklyHours: g.weeklyHours / 2,
		})),
	};
	const repaired = measure(() =>
		repairSchedule(
			variant,
			settings,
			{ previous: schedule, protectedTaskIds: [] },
			benchmarkClock,
		),
	);
	if (
		scheduleViolations(workspace, settings, schedule).length ||
		scheduleViolations(variant, settings, repaired.value).length
	)
		throw Error("Invalid benchmark allocation");
	workspace.planning = { settings, accepted: schedule, history: [] };
	const exported = measure(() => JSON.stringify(workspace));
	const imported = measure(() => parseBackup(exported.value));
	let raw: string | null = null;
	const storage = {
		getItem: () => raw,
		setItem: (_: string, value: string) => {
			raw = value;
		},
	};
	const persisted = measure(() => {
		if (saveWorkspace(storage, workspace)) throw Error("Save failed");
		if (loadWorkspace(storage).status !== "ready") throw Error("Load failed");
	});
	const calendar = measure(() => calendarFile(schedule, benchmarkClock));
	const payload = {
		workspace: { version: 1, goals: workspace.goals, items: [] },
		settings,
		now: benchmarkClock,
	};
	const cold: number[] = [],
		warm: number[] = [],
		compute: number[] = [],
		terminate: number[] = [];
	const worker = new Worker(
		new URL("./node-schedule-worker.ts", import.meta.url),
	);
	try {
		for (let i = -warmup; i < samples; i++) {
			const start = performance.now();
			const response = await workerRequest(worker, payload);
			const elapsed = performance.now() - start;
			if (response.result.error) throw Error(response.result.error);
			if (i >= 0) {
				warm.push(elapsed);
				compute.push(response.computeMs);
			}
		}
	} finally {
		await worker.terminate();
	}
	for (let i = 0; i < samples; i++) {
		const start = performance.now();
		const fresh = new Worker(
			new URL("./node-schedule-worker.ts", import.meta.url),
		);
		try {
			const response = await workerRequest(fresh, payload);
			if (response.result.error) throw Error(response.result.error);
			cold.push(performance.now() - start);
		} finally {
			await fresh.terminate();
		}
		const cancelled = new Worker(
			new URL("./node-schedule-worker.ts", import.meta.url),
		);
		cancelled.postMessage(payload);
		const cancelStart = performance.now();
		await cancelled.terminate();
		terminate.push(performance.now() - cancelStart);
	}
	results.push({
		shape,
		seed: 314,
		sessions: schedule.sessions.length,
		unplacedMinutes: schedule.unscheduled.reduce(
			(n, t) => n + t.remainingMinutes,
			0,
		),
		schedule: scheduled.timing,
		repair: repaired.timing,
		jsonExport: exported.timing,
		jsonImport: imported.timing,
		memoryPortSaveLoad: persisted.timing,
		icsExport: calendar.timing,
		backupBytes: Buffer.byteLength(exported.value),
		workerColdRoundTrip: distribution(cold),
		workerWarmRoundTrip: distribution(warm),
		workerCompute: distribution(compute),
		workerTermination: distribution(terminate),
	});
}
const sourceHash = createHash("sha256");
for (const dir of ["src/frontend/src/planner", "scripts"])
	for (const file of (await readdir(dir))
		.filter((f) => /\.(ts|tsx)$/.test(f))
		.sort()) {
		sourceHash.update(dir + "/" + file);
		sourceHash.update(await readFile(dir + "/" + file));
	}
const report = {
	recordedAt: new Date().toISOString(),
	commit: execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim(),
	dirty: Boolean(
		execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
	),
	sourceSha256: sourceHash.digest("hex"),
	environment: {
		node: process.version,
		platform: process.platform,
		architecture: process.arch,
		cpu: cpus()[0]?.model,
		logicalCpus: cpus().length,
		memoryGiB: Math.round(totalmem() / 2 ** 30),
	},
	clock: benchmarkClock,
	warmup,
	samples,
	algorithm: "earliest-deadline-v1",
	boundaries:
		"Node monotonic clock; direct scheduling/repair includes independent validation. JSON/ICS include serialization/validation. Memory port is not real browser disk/storage. Worker bridge runs the actual production entry in Node worker_threads; cold includes startup, module imports, cloning and reply. Warm includes cloning, compute and reply; workerCompute excludes startup and clone. Termination awaits Node worker termination, not browser cancellation/UI paint. No timing thresholds in CI; p95 of nine is the observed maximum, not a stable population estimate.",
	results,
};
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(
	new URL("../artifacts/scheduling-benchmark.json", import.meta.url),
	JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
