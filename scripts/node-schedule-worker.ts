/** Benchmark/test bridge only. Production uses the browser's module Worker. */
import { parentPort } from "node:worker_threads";
import { performance } from "node:perf_hooks";
let started = 0;
const scope = {
	onmessage: null as null | ((event: { data: unknown }) => void),
	postMessage(result: unknown) {
		parentPort!.postMessage({ result, computeMs: performance.now() - started });
	},
};
(globalThis as any).self = scope;
await import("../src/frontend/src/planner/schedule.worker.ts");
parentPort!.on("message", (data) => {
	started = performance.now();
	scope.onmessage!({ data });
});
