import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import {
	syntheticWorkload,
	workloadShapes,
	benchmarkClock,
} from "../scripts/synthetic-workloads.ts";
import { scheduleViolations } from "../src/frontend/src/planner/scheduler.ts";

test("actual worker entry validates structured-clone requests, schedules, rejects invalid payloads and can restart", async () => {
	const { workspace, settings } = syntheticWorkload(workloadShapes[0]);
	async function request(payload: unknown) {
		const worker = new Worker(
			new URL("../scripts/node-schedule-worker.ts", import.meta.url),
		);
		try {
			return await new Promise<any>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(Error("Worker integration exceeded 10 seconds")),
					10000,
				);
				worker.once("message", (value) => {
					clearTimeout(timeout);
					resolve(value);
				});
				worker.once("error", (error) => {
					clearTimeout(timeout);
					reject(error);
				});
				worker.postMessage(payload);
			});
		} finally {
			await worker.terminate();
		}
	}
	const valid = await request({ workspace, settings, now: benchmarkClock });
	assert.equal(valid.result.error, undefined);
	assert.deepEqual(
		scheduleViolations(workspace, settings, valid.result.schedule),
		[],
	);
	const invalid = await request({
		workspace,
		settings,
		now: benchmarkClock,
		unexpected: true,
	});
	assert.match(invalid.result.error, /invalid/);
	const restarted = await request({ workspace, settings, now: benchmarkClock });
	assert.deepEqual(restarted.result.schedule, valid.result.schedule);
});
