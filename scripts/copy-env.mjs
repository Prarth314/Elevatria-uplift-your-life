import { copyFile } from "node:fs/promises";
await copyFile(
	new URL("../src/frontend/env.json", import.meta.url),
	new URL("../src/frontend/dist/env.json", import.meta.url),
);
