import test from "node:test";
import assert from "node:assert/strict";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "src/frontend");
const require = createRequire(path.join(frontend, "package.json"));
const { loadConfigFromFile } = await import(
	pathToFileURL(require.resolve("vite")).href
);

test("Vite config loads when the hosting platform normalizes or omits vercel.json", async () => {
	const artifacts = path.join(frontend, "node_modules/.cache");
	await mkdir(artifacts, { recursive: true });
	const fixture = await mkdtemp(path.join(artifacts, "vercel-config-"));
	try {
		const app = path.join(fixture, "src/frontend");
		await mkdir(path.join(app, "src/planner"), { recursive: true });
		await writeFile(path.join(fixture, "package.json"), '{"type":"module"}');
		for (const file of [
			"vite.config.js",
			"security-headers.json",
			"src/planner/service-config.ts",
		]) {
			await copyFile(path.join(frontend, file), path.join(app, file));
		}
		const policy = JSON.parse(
			await readFile(path.join(frontend, "security-headers.json"), "utf8"),
		);
		for (const contents of ["{}", null]) {
			const hostConfig = path.join(fixture, "vercel.json");
			if (contents === null) await rm(hostConfig);
			else await writeFile(hostConfig, contents);
			const result = await loadConfigFromFile(
				{ command: "build", mode: "production" },
				path.join(app, "vite.config.js"),
				app,
				"silent",
			);
			assert.ok(
				result,
				"The frontend config should load independently of host configuration",
			);
			assert.deepEqual(result.config.preview?.headers, policy);
		}
	} finally {
		// Only remove this test's generated directory inside the frontend dependency cache.
		assert.equal(path.dirname(path.resolve(fixture)), path.resolve(artifacts));
		assert.ok(path.basename(fixture).startsWith("vercel-config-"));
		await rm(fixture, { recursive: true, force: true });
	}
});

test("Local production preview retains the same security policy as Vercel delivery", async () => {
	const host = JSON.parse(
		await readFile(path.join(root, "vercel.json"), "utf8"),
	);
	const preview = JSON.parse(
		await readFile(path.join(frontend, "security-headers.json"), "utf8"),
	);
	const global = host.headers.find(
		(rule: { source: string }) => rule.source === "/(.*)",
	);
	assert.deepEqual(
		preview,
		Object.fromEntries(
			global.headers.map(({ key, value }: { key: string; value: string }) => [
				key,
				value,
			]),
		),
	);
});
