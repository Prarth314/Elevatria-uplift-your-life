import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";
import { ApiError, workspaceRequest } from "./workspace-service.ts";
import { cloudConfig, supabaseDependencies } from "./supabase-repository.ts";
import {
	frontDoorLimit,
	MAX_REQUEST_BYTES,
	securityHeaders,
	verifyOrigin,
} from "./security.ts";
export async function readBody(
	request: IncomingMessage & { body?: unknown },
): Promise<unknown> {
	if (
		(request.headers["content-type"] ?? "")
			.split(";")[0]
			.trim()
			.toLowerCase() !== "application/json" ||
		(request.headers["content-encoding"] &&
			request.headers["content-encoding"] !== "identity")
	)
		throw new ApiError(
			415,
			"UNSUPPORTED_BODY",
			"Use uncompressed application/json.",
		);
	const length = request.headers["content-length"];
	if (
		length &&
		(!/^\d{1,10}$/.test(length) || Number(length) > MAX_REQUEST_BYTES)
	)
		throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 1.1 MB.");
	let raw: string;
	if (request.body !== undefined) {
		try {
			raw =
				typeof request.body === "string"
					? request.body
					: JSON.stringify(request.body);
		} catch {
			throw new ApiError(
				400,
				"INVALID_JSON",
				"The request is not a supported JSON object.",
			);
		}
	} else {
		let size = 0;
		const chunks: Buffer[] = [];
		const timer = setTimeout(
			() => request.destroy(new Error("BODY_TIMEOUT")),
			8000,
		);
		timer.unref();
		try {
			for await (const chunk of request.iterator({ destroyOnReturn: false })) {
				const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				size += buffer.length;
				if (size > MAX_REQUEST_BYTES)
					throw new ApiError(
						413,
						"REQUEST_TOO_LARGE",
						"Request exceeds 1.1 MB.",
					);
				chunks.push(buffer);
			}
			raw = Buffer.concat(chunks).toString("utf8");
		} catch (error) {
			if (error instanceof ApiError) throw error;
			throw new ApiError(
				408,
				"BODY_TIMEOUT",
				"Request body was interrupted or timed out.",
			);
		} finally {
			clearTimeout(timer);
		}
	}
	if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES)
		throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 1.1 MB.");
	try {
		return JSON.parse(raw);
	} catch {
		throw new ApiError(400, "INVALID_JSON", "Request must contain valid JSON.");
	}
}
export async function handleWorkspace(
	request: IncomingMessage & { body?: unknown },
	response: ServerResponse,
) {
	const requestId = crypto.randomUUID();
	securityHeaders(response);
	response.setHeader("X-Request-Id", requestId);
	try {
		// Only trust forwarding headers when the deployment platform is Vercel, which overwrites XFF.
		const forwarded =
			process.env.VERCEL === "1"
				? request.headers["x-forwarded-for"]
				: undefined;
		const candidate =
			typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
		const address = isIP(candidate)
			? candidate
			: (request.socket.remoteAddress ?? "unknown");
		if (!frontDoorLimit(address))
			throw new ApiError(
				429,
				"RATE_LIMITED",
				"Too many requests. Wait one minute and retry.",
			);
		verifyOrigin(request);
		if (!["GET", "PUT", "DELETE"].includes(request.method ?? ""))
			throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use GET, PUT, or DELETE.");
		const token =
			(request.headers.authorization ?? "").match(
				/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/,
			)?.[1] ?? "";
		if (!token || token.length > 8192)
			throw new ApiError(
				401,
				"AUTH_REQUIRED",
				"Sign in before accessing cloud data.",
			);
		const config = cloudConfig();
		if (!config)
			throw new ApiError(
				503,
				"CLOUD_NOT_CONFIGURED",
				"Cloud storage is not configured. The local planner remains available.",
			);
		const dependencies = supabaseDependencies(config),
			owner = await dependencies.authenticate(token);
		if (!owner)
			throw new ApiError(
				401,
				"AUTH_REQUIRED",
				"Your session is invalid, expired, or not an approved account.",
			);
		const result = await workspaceRequest(
			{
				method: request.method!,
				token,
				body: request.method === "GET" ? undefined : await readBody(request),
			},
			{ repository: dependencies.repository, authenticate: async () => owner },
		);
		response.statusCode = 200;
		response.end(JSON.stringify(result));
	} catch (error) {
		const known = error instanceof ApiError;
		response.statusCode = known ? error.status : 500;
		if (response.statusCode === 405)
			response.setHeader("Allow", "GET, PUT, DELETE");
		if (response.statusCode === 429) response.setHeader("Retry-After", "60");
		if ([408, 413].includes(response.statusCode))
			response.setHeader("Connection", "close");
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
