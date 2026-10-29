import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
	privilegedCredential,
	publicKey,
	serviceUrl,
} from "./src/planner/service-config.ts";
const productionHeaders = Object.fromEntries(
	JSON.parse(
		readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
	).headers[0].headers.map(({ key, value }) => [key, value]),
);
let approvedConnect = "";
let production = false;
export default defineConfig({
	logLevel: "info",
	envDir: "../..",
	publicDir: "public",
	build: { emptyOutDir: true, sourcemap: false, minify: true },
	css: { postcss: "./postcss.config.js" },
	server: {
		host: "127.0.0.1",
		cors: false,
		allowedHosts: ["localhost"],
		fs: {
			strict: true,
			allow: [
				fileURLToPath(new URL("./", import.meta.url)),
				fileURLToPath(new URL("../../node_modules", import.meta.url)),
			],
			deny: [
				"**/.env",
				"**/.env.*",
				"**/*.{pem,key,p12,pfx}",
				"**/.git/**",
				"**/.aws/**",
				"**/.codex/**",
				"**/.agents/**",
				"**/credentials*.json",
				"**/service-account*.json",
			],
		},
		proxy: { "/api": { target: "http://127.0.0.1:5176", changeOrigin: false } },
		headers: {
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			"X-Frame-Options": "DENY",
		},
	},
	preview: {
		host: "127.0.0.1",
		allowedHosts: ["localhost"],
		headers: productionHeaders,
	},
	plugins: [
		{
			name: "public-environment-guard",
			configResolved(config) {
				production = config.command === "build";
				approvedConnect = serviceUrl(config.env.VITE_SUPABASE_URL, false) ?? "";
				for (const [name, value] of Object.entries(config.env))
					if (name.startsWith("VITE_") && privilegedCredential(value))
						throw Error(
							`Privileged credentials cannot be embedded in ${name}.`,
						);
				const key = config.env.VITE_SUPABASE_PUBLISHABLE_KEY,
					url = config.env.VITE_SUPABASE_URL;
				if (
					(key || url) &&
					(!publicKey(key) || !serviceUrl(url, config.command === "serve"))
				)
					throw Error(
						"Supabase public configuration requires an approved URL and publishable/anon key. No credentials were printed.",
					);
			},
			transformIndexHtml() {
				return production
					? [
							{
								tag: "meta",
								attrs: {
									"http-equiv": "Content-Security-Policy",
									content: `connect-src 'self'${approvedConnect ? " " + approvedConnect : ""};`,
								},
								injectTo: "head-prepend",
							},
						]
					: [];
			},
		},
		react(),
	],
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
