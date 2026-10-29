import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const cwd = fileURLToPath(new URL("src/frontend/", root));
const [command, ...args] = process.argv.slice(2);
const commands = {
	dev: ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
	preview: ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1"],
	build: ["node_modules/vite/bin/vite.js", "build"],
	typecheck: [
		"node_modules/typescript/bin/tsc",
		"--noEmit",
		"--pretty",
		"false",
	],
};
if (!(command in commands))
	throw new Error("Expected dev, preview, build, or typecheck");
const child = spawn(process.execPath, [...commands[command], ...args], {
	cwd,
	stdio: "inherit",
});
child.on("error", (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.on("exit", code => { process.exitCode=code??1; });
