import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "src/frontend/package.json"));
const ts = require("typescript") as typeof import(
	"../src/frontend/node_modules/typescript/lib/typescript.d.ts",
);

test("Deployment compiler emits an executable ESM API with resolved JavaScript imports", async () => {
	const artifacts = path.join(root, "artifacts");
	await mkdir(artifacts, { recursive: true });
	const fixture = await mkdtemp(path.join(artifacts, "deployment-api-"));
	try {
		const file = path.join(root, "tsconfig.json");
		const config = ts.readConfigFile(file, ts.sys.readFile);
		assert.equal(config.error, undefined);
		const parsed = ts.parseJsonConfigFileContent(
			config.config,
			ts.sys,
			root,
			{ outDir: fixture, noEmitOnError: true },
			file,
		);
		const program = ts.createProgram(parsed.fileNames, parsed.options);
		const diagnostics = [
			...parsed.errors,
			...ts.getPreEmitDiagnostics(program),
		];
		assert.equal(
			diagnostics.length,
			0,
			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
				getCanonicalFileName: (name: string) => name,
				getCurrentDirectory: () => root,
				getNewLine: () => "\n",
			}),
		);
		const emitted = program.emit();
		assert.equal(emitted.emitSkipped, false);
		const { default: handler } = await import(
			pathToFileURL(path.join(fixture, "api/workspace.js")).href
		);
		assert.equal(typeof handler, "function");
		const headers = new Map<string, string>();
		let body = "";
		const response = {
			statusCode: 200,
			setHeader: (name: string, value: string) =>
				headers.set(name.toLowerCase(), value),
			end: (value: string) => {
				body = value;
			},
		} as unknown as ServerResponse;
		const request = {
			method: "GET",
			headers: {},
			socket: { remoteAddress: "deployment-smoke" },
		} as unknown as IncomingMessage;
		await handler(request, response);
		assert.equal(response.statusCode, 401);
		assert.equal(JSON.parse(body).error.code, "AUTH_REQUIRED");
		assert.match(headers.get("cache-control")!, /no-store/);
	} finally {
		assert.equal(path.dirname(path.resolve(fixture)), path.resolve(artifacts));
		assert.ok(path.basename(fixture).startsWith("deployment-api-"));
		await rm(fixture, { recursive: true, force: true });
	}
});
