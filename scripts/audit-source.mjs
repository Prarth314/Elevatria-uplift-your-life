import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { scanText } from "./secret-rules.mjs";
const flags = new Set(process.argv.slice(2));
const skip = new Set([
	".git",
	"node_modules",
	".pnpm-store",
	"artifacts",
	".cache",
	".vite",
]);
if (!flags.has("--dist")) skip.add("dist");
let files = 0,
	high = 0,
	review = 0;
function report(text, file, blob) {
	files++;
	for (const finding of scanText(text)) {
		if (finding.severity === "high") high += finding.count;
		else review += finding.count;
		console.log(
			JSON.stringify({
				file,
				...(blob ? { blob: blob.slice(0, 12) } : {}),
				...finding,
			}),
		);
	}
}
async function walk(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (skip.has(entry.name) || entry.isSymbolicLink()) continue;
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) await walk(file);
		else if (
			/\.(?:tsx?|jsx?|mjs|json|ya?ml|md|css|html|sh|mo|did|sql|txt|toml|xml|conf|ini|lock|pem|key|p12|pfx)$/.test(
				file,
			) ||
			entry.name.startsWith(".env")
		)
			report(await readFile(file, "utf8"), file);
	}
}
await walk(".");
if (flags.has("--history")) {
	const listing = spawnSync("git", ["rev-list", "--objects", "--all"], {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
	if (listing.status !== 0) throw Error("Git object inventory failed.");
	const objects = listing.stdout.split("\n").flatMap((line) => {
		const match = /^([a-f0-9]{40,64}) (.+)$/.exec(line);
		return match &&
			(/\.(?:tsx?|jsx?|mjs|json|ya?ml|md|css|html|sh|mo|did|sql|txt|toml|xml|conf|ini|lock|pem|key|p12|pfx)$/.test(
				match[2],
			) ||
				/(?:^|\/)\.env/.test(match[2]))
			? [{ hash: match[1], file: match[2] }]
			: [];
	});
	const result = spawnSync("git", ["cat-file", "--batch"], {
		input: objects.map((x) => x.hash).join("\n") + "\n",
		maxBuffer: 128 * 1024 * 1024,
	});
	if (result.status !== 0) throw Error("Git blob scan failed.");
	let offset = 0;
	for (const object of objects) {
		const newline = result.stdout.indexOf(10, offset);
		const header = result.stdout
			.subarray(offset, newline)
			.toString()
			.split(" ");
		const length = Number(header[2]);
		if (newline < 0 || !Number.isSafeInteger(length))
			throw Error("Invalid Git object response.");
		offset = newline + 1;
		if (header[1] === "blob")
			report(
				result.stdout.subarray(offset, offset + length).toString("utf8"),
				object.file,
				object.hash,
			);
		offset += length + 1;
	}
}
console.log(
	JSON.stringify({
		filesScanned: files,
		highConfidenceFindings: high,
		contextReviewFindings: review,
		scope: { history: flags.has("--history"), dist: flags.has("--dist") },
		note: "Pattern scans do not establish absence of every secret or PII format. Binary assets require separate review.",
	}),
);
if (high) process.exitCode = 1;
