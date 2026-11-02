import {
	syntheticWorkload,
	workloadShapes,
	benchmarkClock,
} from "./synthetic-workloads.ts";
import { workerRequest } from "../src/frontend/src/planner/worker-transport.ts";
import { decodeSchedule } from "../src/frontend/src/planner/worker-client.ts";
const run = document.querySelector<HTMLButtonElement>("#run")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel")!;
const status = document.querySelector<HTMLElement>("#status")!;
const report = document.querySelector<HTMLElement>("#browser-report")!;
let active: AbortController | undefined;
cancel.onclick = () => active?.abort();
const stats = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b),
		round = (n: number) => Math.round(n * 100) / 100;
	return {
		samples: values.length,
		medianMs: round(sorted[Math.floor(sorted.length / 2)]),
		maxMs: round(sorted.at(-1)!),
		minMs: round(sorted[0]),
	};
};
run.onclick = async () => {
	const controller = new AbortController();
	active = controller;
	run.disabled = true;
	cancel.disabled = false;
	report.textContent = "";
	const results = [],
		frames: number[] = [],
		visibilityChanges: string[] = [];
	let frame = 0,
		previous = 0;
	const tick = (time: number) => {
		if (previous && frames.length < 7200) frames.push(time - previous);
		previous = time;
		frame = requestAnimationFrame(tick);
	};
	const changed = () => visibilityChanges.push(document.visibilityState);
	document.addEventListener("visibilitychange", changed);
	frame = requestAnimationFrame(tick);
	try {
		for (const shape of workloadShapes) {
			const { workspace, settings } = syntheticWorkload(shape);
			const total: number[] = [],
				reply: number[] = [],
				validation: number[] = [],
				repair: number[] = [];
			let schedule;
			for (let i = -2; i < 5; i++) {
				status.textContent = `${shape.tasks} tasks · scheduling run ${i + 3}/7`;
				const start = performance.now();
				let received = start,
					validate = 0;
				schedule = await workerRequest(
					() =>
						new Worker(
							new URL(
								"../src/frontend/src/planner/schedule.worker.ts",
								import.meta.url,
							),
							{ type: "module" },
						),
					{ workspace, settings, now: benchmarkClock },
					controller.signal,
					(value) => {
						received = performance.now();
						const decoded = decodeSchedule(workspace, settings, value);
						validate = performance.now() - received;
						return decoded;
					},
				);
				if (i >= 0) {
					total.push(performance.now() - start);
					reply.push(received - start);
					validation.push(validate);
				}
			}
			const next = {
				...workspace,
				goals: workspace.goals.map((g) => ({
					...g,
					weeklyHours: g.weeklyHours / 2,
				})),
			};
			for (let i = -2; i < 5; i++) {
				status.textContent = `${shape.tasks} tasks · recovery run ${i + 3}/7`;
				const start = performance.now();
				await workerRequest(
					() =>
						new Worker(
							new URL(
								"../src/frontend/src/planner/schedule.worker.ts",
								import.meta.url,
							),
							{ type: "module" },
						),
					{
						workspace: next,
						settings,
						now: benchmarkClock,
						repair: { previous: schedule, protectedTaskIds: [] },
					},
					controller.signal,
					(value) => decodeSchedule(next, settings, value),
				);
				if (i >= 0) repair.push(performance.now() - start);
			}
			results.push({
				shape,
				seed: 314,
				coldValidatedRoundTrip: stats(total),
				coldReply: stats(reply),
				mainThreadValidation: stats(validation),
				coldValidatedRecovery: stats(repair),
			});
		}
		const abort = new AbortController();
		let terminations = 0;
		const cancellation = workerRequest(
			() => {
				const worker = new Worker(
					new URL(
						"../src/frontend/src/planner/schedule.worker.ts",
						import.meta.url,
					),
					{ type: "module" },
				);
				const terminate = worker.terminate.bind(worker);
				worker.terminate = () => {
					terminations++;
					terminate();
				};
				return worker;
			},
			{},
			abort.signal,
			() => {
				throw Error("Cancelled request unexpectedly decoded");
			},
		);
		const cancelStart = performance.now();
		abort.abort();
		let rejected = false;
		try {
			await cancellation;
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") rejected = true;
			else throw e;
		}
		if (!rejected || terminations !== 1)
			throw Error("Cancellation cleanup failed");
		report.textContent = JSON.stringify(
			{
				commit: document.body.dataset.commit,
				dirty: document.body.dataset.dirty === "true",
				harnessBundleSha256: document.body.dataset.buildHash,
				recordedAt: new Date().toISOString(),
				userAgent: navigator.userAgent,
				hardwareConcurrency: navigator.hardwareConcurrency,
				clock: benchmarkClock,
				warmup: 2,
				samples: 5,
				visibility: document.visibilityState,
				visibilityChanges,
				results,
				cancellation: {
					rejected,
					terminations,
					abortToRejectionMs: performance.now() - cancelStart,
				},
				testPageFrames: frames.length ? stats(frames) : null,
				note: "Fresh real browser module workers using production entry and transport. Reply includes startup/clone/compute; validation is main-thread. Frame gaps describe the synthetic test page, not planner UI, INP or a user study. Five samples do not establish stable tail latency.",
			},
			null,
			2,
		);
		status.textContent =
			"Browser benchmark complete; all outputs validated and cancellation cleanup passed.";
	} catch (e) {
		status.textContent =
			e instanceof Error ? e.message : "Browser verification failed";
	} finally {
		cancelAnimationFrame(frame);
		document.removeEventListener("visibilitychange", changed);
		active = undefined;
		run.disabled = false;
		cancel.disabled = true;
	}
};
