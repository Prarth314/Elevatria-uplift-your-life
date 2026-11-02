export {};
// Served only by browser-check.mjs; no telemetry, storage, user content or app-state access.
const panel = document.createElement("details");
panel.setAttribute("aria-label", "Local performance verification");
panel.style.cssText =
	"position:fixed;bottom:8px;right:8px;z-index:10000;max-width:calc(100vw - 16px);max-height:45vh;overflow:auto;background:white;color:#172c21;border:2px solid #345740;padding:10px;font:12px system-ui";
const summary = document.createElement("summary");
summary.textContent = "Local performance verification";
panel.append(summary);
const start = document.createElement("button"),
	stop = document.createElement("button"),
	output = document.createElement("pre");
start.textContent = "Start UI profile";
stop.textContent = "Stop UI profile";
stop.disabled = true;
output.id = "ui-profile-report";
output.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere";
panel.append(start, stop, output);
document.body.append(panel);
let frame = 0,
	timeout: ReturnType<typeof setTimeout>,
	observer: PerformanceObserver | undefined;
let frames: number[] = [],
	longTasks: { startMs: number; durationMs: number }[] = [],
	previous = 0,
	started = 0,
	initialVisibility = "";
start.onclick = () => {
	frames = [];
	longTasks = [];
	previous = 0;
	started = performance.now();
	initialVisibility = document.visibilityState;
	start.disabled = true;
	stop.disabled = false;
	output.textContent =
		"Recording bounded frame gaps and long tasks; no plan content is collected.";
	const tick = (time: number) => {
		if (previous && frames.length < 7200) frames.push(time - previous);
		previous = time;
		frame = requestAnimationFrame(tick);
	};
	frame = requestAnimationFrame(tick);
	if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
		observer = new PerformanceObserver((list) => {
			for (const e of list.getEntries())
				if (longTasks.length < 500)
					longTasks.push({
						startMs: e.startTime - started,
						durationMs: e.duration,
					});
		});
		observer.observe({ type: "longtask" });
	}
	timeout = setTimeout(() => stop.click(), 120000);
};
stop.onclick = () => {
	cancelAnimationFrame(frame);
	clearTimeout(timeout);
	if (observer) {
		for (const e of observer.takeRecords())
			if (longTasks.length < 500)
				longTasks.push({
					startMs: e.startTime - started,
					durationMs: e.duration,
				});
		observer.disconnect();
		observer = undefined;
	}
	const sorted = [...frames].sort((a, b) => a - b);
	output.textContent = JSON.stringify(
		{
			durationMs: performance.now() - started,
			frameSamples: frames.length,
			medianFrameGapMs: sorted[Math.floor(sorted.length / 2)] ?? null,
			maxFrameGapMs: sorted.at(-1) ?? null,
			longTaskSupported:
				PerformanceObserver.supportedEntryTypes.includes("longtask"),
			longTasks,
			initialVisibility,
			finalVisibility: document.visibilityState,
			userAgent: navigator.userAgent,
			note: "Observed synthetic planner interactions on this device. Frame gaps include browser/automation/background effects; not INP, a production SLA or a usability result.",
		},
		null,
		2,
	);
	start.disabled = false;
	stop.disabled = true;
};
