// Local-only verification server. Never imported by, or deployed with, the app.
import { createServer } from "node:http";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
	new URL("../src/frontend/package.json", import.meta.url),
);
const { build } = await import(pathToFileURL(require.resolve("vite")).href);
const output = path.join(root, "artifacts/browser-check");
await mkdir(output, { recursive: true });
await build({
	configFile: false,
	root,
	base: "/verification/",
	publicDir: false,
	build: {
		outDir: output,
		emptyOutDir: true,
		sourcemap: false,
		rolldownOptions: {
			input: {
				benchmark: path.join(root, "scripts/browser-check.ts"),
				observer: path.join(root, "scripts/browser-observer.ts"),
			},
			output: { entryFileNames: "[name].js" },
		},
	},
	worker: { format: "es" },
});
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
	cwd: root,
	encoding: "utf8",
}).trim();
const bundleHash = createHash("sha256");
for (const name of [
	"benchmark.js",
	"observer.js",
	...(await readdir(path.join(output, "assets")))
		.sort()
		.map((n) => "assets/" + n),
]) {
	bundleHash.update(name);
	bundleHash.update(await readFile(path.join(output, name)));
}
const buildHash = bundleHash.digest("hex");
const dirty = Boolean(
	execFileSync("git", ["status", "--porcelain"], {
		cwd: root,
		encoding: "utf8",
	}).trim(),
);
await writeFile(
	path.join(output, "index.html"),
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elevatria local browser verification</title></head><body data-commit="${commit}" data-dirty="${dirty}" data-build-hash="${buildHash}"><main><h1>Local browser verification</h1><p>Synthetic data only. No accounts, storage writes or external requests. The normal app is at <a href="/">the planner</a>.</p><p>Five measured runs after two warm-ups per workload. Fresh module workers include startup, cloning and reply; validation is measured on the main thread. Frame gaps describe this test page, not planner rendering or INP.</p><button id="run">Run browser benchmark</button> <button id="cancel" disabled>Cancel benchmark</button><p id="status" role="status">Ready</p><pre id="browser-report" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></main><script type="module" src="/verification/benchmark.js"></script></body></html>`,
);
if (process.argv.includes("--build-only")) process.exit(0);
const files = new Map();
async function inventory(directory, prefix) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name),
			url = `${prefix}/${entry.name}`;
		if (entry.isDirectory()) await inventory(file, url);
		else if (entry.isFile()) files.set(url, file);
	}
}
await inventory(path.join(root, "src/frontend/dist"), "");
await inventory(output, "/verification");
const headers = JSON.parse(
	await readFile(path.join(root, "src/frontend/security-headers.json"), "utf8"),
);
const mime = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".woff2": "font/woff2",
	".png": "image/png",
	".svg": "image/svg+xml",
	".json": "application/json",
};
const server = createServer(async (req, res) => {
	if (!["127.0.0.1:4191", "localhost:4191"].includes(req.headers.host)) {
		res.writeHead(403).end("Untrusted local host");
		return;
	}
	for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
	res.setHeader("Cache-Control", "no-store");
	if (!["GET", "HEAD"].includes(req.method)) {
		res.writeHead(405).end();
		return;
	}
	try {
		const url = new URL(req.url, "http://127.0.0.1:4191");
		let route = decodeURIComponent(url.pathname);
		if (route === "/" || route === "/dashboard") route = "/index.html";
		if (route === "/verification/" || route === "/verification")
			route = "/verification/index.html";
		const file = files.get(route);
		if (!file) {
			res.writeHead(404).end("Not found");
			return;
		}
		let body = await readFile(file);
		if (route === "/index.html")
			body = Buffer.from(
				body
					.toString()
					.replace(
						"</head>",
						'<script type="module" src="/verification/observer.js"></script></head>',
					),
			);
		res.setHeader(
			"Content-Type",
			`${mime[path.extname(file)] ?? "application/octet-stream"}; charset=utf-8`,
		);
		res.end(req.method === "HEAD" ? undefined : body);
	} catch {
		res.writeHead(400).end("Invalid local verification request");
	}
});
server.requestTimeout = 10000;
server.headersTimeout = 5000;
server.listen(4191, "127.0.0.1", () =>
	console.log(
		"Planner + local profile controls: http://127.0.0.1:4191/\nSynthetic browser benchmark: http://127.0.0.1:4191/verification/",
	),
);
