import type { IncomingMessage, ServerResponse } from "node:http";
import { ApiError, workspaceRequest } from "./workspace-service.ts";
import { cloudConfig, supabaseDependencies } from "./supabase-repository.ts";
export async function readBody(
	request: IncomingMessage & { body?: unknown },
): Promise<unknown> {
	if (request.body !== undefined) {
		const raw =
			typeof request.body === "string"
				? request.body
				: JSON.stringify(request.body);
		if (Buffer.byteLength(raw) > 1_100_000)
			throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 1.1 MB.");
		try {
			return JSON.parse(raw);
		} catch {
			throw new ApiError(
				400,
				"INVALID_JSON",
				"Request must contain valid JSON.",
			);
		}
	}
	let size = 0;
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > 1_100_000)
			throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 1.1 MB.");
		chunks.push(buffer);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new ApiError(400, "INVALID_JSON", "Request must contain valid JSON.");
	}
}
export async function handleWorkspace(
	request: IncomingMessage & { body?: unknown },
	response: ServerResponse,
) {
	const requestId = crypto.randomUUID();
	response.setHeader("Content-Type", "application/json");
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Request-Id", requestId);
	try {
		if (!["GET", "PUT", "DELETE"].includes(request.method ?? ""))
			throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use GET, PUT, or DELETE.");
		const config = cloudConfig();
		if (!config)
			throw new ApiError(
				503,
				"CLOUD_NOT_CONFIGURED",
				"Cloud storage is not configured. The local planner remains available.",
			);
		const origin = request.headers.origin;
		if (origin) {
			let matches = false;
			try {
				matches = new URL(origin).host === request.headers.host;
			} catch {}
			if (!matches)
				throw new ApiError(
					403,
					"ORIGIN_REJECTED",
					"Cross-origin requests are not accepted.",
				);
		}
		const method = request.method ?? "GET";
		const token =
			(request.headers.authorization ?? "").match(/^Bearer ([^\s]+)$/)?.[1] ??
			"";
		if (!token)
			throw new ApiError(
				401,
				"AUTH_REQUIRED",
				"Sign in before accessing cloud data.",
			);
		const result = await workspaceRequest(
			{
				method,
				token,
				body: method === "GET" ? undefined : await readBody(request),
			},
			supabaseDependencies(config),
		);
		response.statusCode = 200;
		response.end(JSON.stringify(result));
	} catch (error) {
		const known = error instanceof ApiError;
		response.statusCode = known ? error.status : 500;
		if (response.statusCode === 405)
			response.setHeader("Allow", "GET, PUT, DELETE");
		response.end(
			JSON.stringify({
				error: {
					code: known ? error.code : "INTERNAL_ERROR",
					message: known
						? error.message
						: "The request could not be completed.",
					requestId,
				},
			}),
		);
	}
}
