import {
	saveLocalWorkspace,
	WORKSPACE_KEY,
} from "../src/frontend/src/planner/persistence.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sampleWorkspace } from "../src/frontend/src/planner/sample.ts";
import { validWorkspace } from "../src/frontend/src/planner/model.ts";
import {
	safeImage,
	imageHeader,
	safeDimensions,
} from "../src/frontend/src/planner/images.ts";
import {
	serviceUrl,
	publicKey,
	privilegedCredential,
} from "../src/frontend/src/planner/service-config.ts";
import {
	validPlanning,
	settingsErrors,
} from "../src/frontend/src/planner/schedule-validation.ts";
import {
	CloudEpoch,
	mayReplaceAfterSave,
} from "../src/frontend/src/planner/cloud-state.ts";
import { chartCss } from "../src/frontend/src/lib/chart-style.ts";
import { readBody, handleWorkspace } from "../src/server/http.ts";
import {
	frontDoorLimit,
	limitedJson,
	verifyOrigin,
} from "../src/server/security.ts";
import { ApiError } from "../src/server/workspace-service.ts";
import { scanText } from "../scripts/secret-rules.mjs";
const png =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrYcAAAAASUVORK5CYII=";
const status = (number: number) => (error: unknown) =>
	error instanceof ApiError && error.status === number;
test("strict JSON schema rejects unknown properties, prototype keys, control characters, and aggregate task overflow", () => {
	for (const mutate of [
		(w: any) => (w.credentials = "unexpected"),
		(w: any) => (w.goals[0].ownerId = "someone-else"),
		(w: any) => (w.goals[0].milestones[0].tasks[0].id = "bad\r\nidentifier"),
		(w: any) => (w.items[0].content = "bad\0text"),
		(w: any) =>
			Object.defineProperty(w, "__proto__", {
				value: { admin: true },
				enumerable: true,
			}),
		(w: any) =>
			(w.planning = {
				settings: {
					timezone: undefined,
					horizonDays: 28,
					sessionMinutes: 60,
					breakMinutes: 10,
					windows: [],
					commitments: [],
				},
				history: [],
			}),
	]) {
		const workspace = sampleWorkspace();
		mutate(workspace);
		assert.equal(validWorkspace(workspace), false);
	}
	const huge = sampleWorkspace();
	huge.goals[0].milestones = Array.from({ length: 11 }, (_, m) => ({
		id: `m${m}`,
		title: "Milestone",
		tasks: Array.from({ length: 100 }, (_, t) => ({
			id: `m${m}-t${t}`,
			title: "Task",
			minutes: 30,
			completed: false,
		})),
	}));
	assert.equal(validWorkspace(huge), false);
	assert.deepEqual({}.constructor, Object);
});
test("image signatures and decoded dimension headers reject renamed HTML, MIME spoofing, and pixel bombs", () => {
	assert.equal(safeImage(png), true);
	assert.equal(safeImage("data:image/png;base64,AA=="), false);
	assert.equal(safeImage(png.replace("image/png", "image/jpeg")), false);
	const bytes = Uint8Array.from(atob(png.split(",")[1]), (c) =>
		c.charCodeAt(0),
	);
	new DataView(bytes.buffer).setUint32(16, 100000);
	assert.equal(safeDimensions(imageHeader(bytes)), false);
	assert.equal(
		safeImage("data:image/png;base64," + Buffer.from(bytes).toString("base64")),
		false,
	);
	assert.equal(
		safeImage("data:image/svg+xml;base64," + btoa('<svg onload="alert(1)"/>')),
		false,
	);
});
test("service configuration rejects SSRF destinations, credentials in URLs, redirects-as-config, and browser secrets", () => {
	for (const url of [
		"http://example.supabase.co",
		"https://evil.example",
		"https://project.supabase.co.evil.example",
		"https://user:password@project.supabase.co",
		"https://project.supabase.co/path",
		"https://project.supabase.co/?secret=1",
		"ftp://localhost",
		"file:///etc/passwd",
		"http://169.254.169.254",
	])
		assert.equal(serviceUrl(url), null);
	assert.equal(
		serviceUrl("https://project.supabase.co/"),
		"https://project.supabase.co",
	);
	assert.equal(serviceUrl("http://127.0.0.1:54321"), null);
	assert.equal(
		serviceUrl("http://127.0.0.1:54321", true),
		"http://127.0.0.1:54321",
	);
	const jwt = (role: string) =>
		[
			"eyJhbGciOiJIUzI1NiJ9",
			Buffer.from(JSON.stringify({ role })).toString("base64url"),
			"synthetic",
		].join(".");
	assert.equal(publicKey(jwt("anon")), true);
	assert.equal(publicKey(jwt("service_role")), false);
	assert.equal(privilegedCredential(jwt("authenticated")), true);
	assert.equal(privilegedCredential("sb_" + "secret_" + "test"), true);
});
test("accepted/history schema is bounded and rejects false acceptance and hidden metadata", () => {
	const settings = {
		timezone: "UTC",
		horizonDays: 28,
		sessionMinutes: 60,
		breakMinutes: 10,
		windows: [],
		commitments: [],
	};
	assert.equal(
		validPlanning({ settings, history: [], accepted: false }),
		false,
	);
	assert.equal(
		validPlanning({ settings, history: [], extra: "hidden" }),
		false,
	);
	assert.ok(settingsErrors({ ...settings, timezone: undefined } as any).length);
});
test("account epochs discard stale callbacks and save responses cannot replace newer edits", () => {
	const epoch = new CloudEpoch(),
		request = epoch.current();
	epoch.next();
	assert.equal(epoch.matches(request), false);
	const submitted = sampleWorkspace(),
		newer = structuredClone(submitted);
	assert.equal(mayReplaceAfterSave(submitted, newer), false);
	assert.equal(mayReplaceAfterSave(submitted, submitted), true);
});
test("chart styles reject selector, CSS rule, and external-resource injection", () => {
	assert.equal(chartCss('chart"]{}body', { ok: { color: "red" } }), "");
	const css = chartCss("safe", {
		ok: { color: "#abc" },
		bad: { color: "red;}body{background:url(https://evil.example)" },
	});
	assert.match(css, /--color-ok: #abc/);
	assert.ok(!css.includes("evil"));
	assert.ok(!css.includes("--color-bad"));
});
test("request reader rejects unsupported encoding/type, oversized bodies and invalid JSON", async () => {
	const request = (headers: Record<string, string>, body: unknown) =>
		({ headers, body }) as unknown as IncomingMessage & { body?: unknown };
	await assert.rejects(() => readBody(request({}, "{}")), status(415));
	await assert.rejects(
		() =>
			readBody(
				request(
					{ "content-type": "application/json", "content-encoding": "gzip" },
					"{}",
				),
			),
		status(415),
	);
	await assert.rejects(
		() =>
			readBody(
				request(
					{ "content-type": "application/json", "content-length": "1100001" },
					"{}",
				),
			),
		status(413),
	);
	await assert.rejects(
		() => readBody(request({ "content-type": "application/json" }, "[")),
		status(400),
	);
	const stream = Readable.from([
		"x".repeat(600000),
		"x".repeat(600000),
	]) as unknown as IncomingMessage;
	stream.headers = { "content-type": "application/json" };
	await assert.rejects(() => readBody(stream), status(413));
	assert.deepEqual(
		await readBody(
			request({ "content-type": "application/json" }, '{"expectedRevision":1}'),
		),
		{ expectedRevision: 1 },
	);
});
test("upstream JSON is bounded, origins include scheme, and local throttle is bounded by a minute", async () => {
	await assert.rejects(
		() => limitedJson(new Response("x".repeat(100)), 20),
		status(502),
	);
	await assert.rejects(() => limitedJson(new Response("bad")), status(502));
	const request = (origin: string) =>
		({ headers: { origin, host: "app.example" } }) as IncomingMessage;
	assert.throws(() => verifyOrigin(request("http://app.example")), status(403));
	assert.throws(
		() => verifyOrigin(request("https://evil.example")),
		status(403),
	);
	assert.doesNotThrow(() => verifyOrigin(request("https://app.example")));
	const ip = "test-throttle-" + crypto.randomUUID();
	for (let i = 0; i < 120; i++) assert.equal(frontDoorLimit(ip, 1000), true);
	assert.equal(frontDoorLimit(ip, 1000), false);
	assert.equal(frontDoorLimit(ip, 61000), true);
});
test("HTTP errors fail closed, carry security headers and never reflect bearer credentials", async () => {
	const headers = new Map<string, string>();
	let body = "";
	const response = {
		statusCode: 200,
		setHeader: (key: string, value: string) =>
			headers.set(key.toLowerCase(), value),
		end: (value: string) => {
			body = value;
		},
	} as unknown as ServerResponse;
	const request = {
		method: "GET",
		headers: { authorization: "Bearer secret-with-invalid-format" },
		socket: { remoteAddress: "http-test-" + crypto.randomUUID() },
	} as unknown as IncomingMessage;
	await handleWorkspace(request, response);
	assert.equal(response.statusCode, 401);
	assert.match(headers.get("cache-control")!, /no-store/);
	assert.equal(headers.get("x-content-type-options"), "nosniff");
	assert.ok(!body.includes("secret-with-invalid-format"));
	assert.equal(JSON.parse(body).error.code, "AUTH_REQUIRED");
});
test("credential scanner reports metadata and fails on real-looking credentials without echoing them", () => {
	const secret = "sb_" + "secret_" + "a".repeat(32),
		result = scanText(secret);
	assert.ok(result.some((x) => x.severity === "high"));
	assert.ok(!JSON.stringify(result).includes(secret));
	assert.ok(
		scanText("someone@example.test").some((x) => x.severity === "review"),
	);
});

test("local retry/reset persistence never stores account documents", () => {
	const local = sampleWorkspace(),
		account = sampleWorkspace();
	account.goals[0].title = "Private account goal";
	const values = new Map([[WORKSPACE_KEY, JSON.stringify(local)]]);
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};
	assert.match(
		saveLocalWorkspace(storage, account, "account-owner")!,
		/cannot be saved/,
	);
	assert.deepEqual(JSON.parse(values.get(WORKSPACE_KEY)!), local);
	assert.equal(saveLocalWorkspace(storage, local, null), null);
});

test("Public key aliases accept anon configuration but reject conflicts and privileged keys", async () => {
	const { configuredPublicKey } = await import(
		"../src/frontend/src/planner/service-config.ts"
	);
	const anon = [
		"eyJhbGciOiJIUzI1NiJ9",
		Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url"),
		"synthetic",
	].join(".");
	assert.equal(configuredPublicKey(undefined, anon), anon);
	assert.equal(configuredPublicKey(anon, anon), anon);
	assert.equal(
		configuredPublicKey("sb_publishable_abcdefghijklm", anon),
		undefined,
	);
	assert.equal(
		configuredPublicKey(undefined, "sb_" + "secret_" + "test"),
		undefined,
	);
});
