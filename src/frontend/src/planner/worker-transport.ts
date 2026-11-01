/** Injectable worker transport with one settlement and unconditional cleanup. */
export interface WorkerPort {
	onmessage: ((event: MessageEvent<unknown>) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
	postMessage(value: unknown): void;
	terminate(): void;
}
export interface WorkerClock {
	start(callback: () => void, milliseconds: number): unknown;
	clear(handle: unknown): void;
}
const clock: WorkerClock = {
	start: (callback, ms) => setTimeout(callback, ms),
	clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export function workerRequest<T>(
	create: () => WorkerPort,
	payload: unknown,
	signal: AbortSignal,
	decode: (value: unknown) => T,
	timer: WorkerClock = clock,
): Promise<T> {
	if (signal.aborted)
		return Promise.reject(new DOMException("Cancelled", "AbortError"));
	return new Promise((resolve, reject) => {
		let worker: WorkerPort | undefined;
		let timeout: unknown;
		let settled = false;
		function finish(error?: unknown, result?: T) {
			if (settled) return;
			settled = true;
			timer.clear(timeout);
			signal.removeEventListener("abort", abort);
			if (worker) {
				worker.onmessage = worker.onerror = worker.onmessageerror = null;
				worker.terminate();
			}
			if (error) reject(error);
			else resolve(result!);
		}
		function abort() {
			finish(new DOMException("Cancelled", "AbortError"));
		}
		try {
			worker = create();
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) {
				abort();
				return;
			}
			timeout = timer.start(
				() =>
					finish(
						Error(
							"Scheduling exceeded the five-second limit. Reduce the horizon or task count and retry.",
						),
					),
				5000,
			);
			worker.onmessage = ({ data }) => {
				if (settled) return;
				try {
					finish(undefined, decode(data));
				} catch (error) {
					finish(error);
				}
			};
			worker.onerror = worker.onmessageerror = () =>
				finish(
					Error(
						"Background scheduling failed. Your accepted schedule is unchanged. Retry to start a new worker.",
					),
				);
			worker.postMessage(payload);
		} catch {
			finish(
				Error(
					"Background scheduling could not start. Your accepted schedule is unchanged. Retry or export your board.",
				),
			);
		}
	});
}
