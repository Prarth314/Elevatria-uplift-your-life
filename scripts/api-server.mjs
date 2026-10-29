import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { handleWorkspace } from "../src/server/http.ts";
const require = createRequire(
	new URL("../src/frontend/package.json", import.meta.url),
);
require("dotenv").config({
	path: fileURLToPath(new URL("../.env", import.meta.url)),
});
const server = createServer((req, res) => {
	if (req.url === "/api/workspace") {
		void handleWorkspace(req, res);
	} else {
		res.statusCode = 404;
		res.end("Not found");
	}
});
server.listen(5176, "127.0.0.1", () =>
	console.log("Elevatria local API: http://127.0.0.1:5176"),
);
