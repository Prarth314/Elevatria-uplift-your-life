import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { ApiError } from "./workspace-service.ts";
export const MAX_REQUEST_BYTES = 1_100_000;
/** A bounded process-local front-door throttle; database RPCs enforce shared account limits. */
const buckets = new Map<string, { started: number; count: number }>();
export function frontDoorLimit(address: string, now = Date.now()): boolean {
	const key = createHash("sha256").update(address).digest("hex");
	const old = buckets.get(key);
	if (old && now - old.started < 60000) {
		old.count++;
		return old.count <= 120;
	}
	if (buckets.size >= 2048) {
		for (const [id, b] of buckets)
			if (now - b.started >= 60000) buckets.delete(id);
		if (buckets.size >= 2048) buckets.delete(buckets.keys().next().value!);
	}
	buckets.set(key, { started: now, count: 1 });
	return true;
}
export function securityHeaders(response: ServerResponse) {
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	response.setHeader("Cache-Control", "no-store, private");
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Frame-Options", "DENY");
	response.setHeader(
		"Content-Security-Policy",
		"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
	);
	response.setHeader("Vary", "Authorization");
}
export function verifyOrigin(request: IncomingMessage) {
	const origin = request.headers.origin;
	if (!origin) return;
	try {
		const url = new URL(origin);
		const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		if (
			url.origin !== origin ||
			url.host !== request.headers.host ||
			!(
				url.protocol === "https:" ||
				(process.env.NODE_ENV !== "production" &&
					local &&
					url.protocol === "http:")
			)
		)
			throw Error();
	} catch {
		throw new ApiError(
			403,
			"ORIGIN_REJECTED",
			"Cross-origin requests are not accepted.",
		);
	}
}
export async function limitedJson(
	response: Response,
	max = 1_100_000,
): Promise<unknown> {
	const declared = response.headers.get("content-length");
	if (declared && Number(declared) > max) {
		await response.body?.cancel();
		throw new ApiError(
			502,
			"INVALID_UPSTREAM_RESPONSE",
			"The service returned an oversized response.",
		);
	}
	if (!response.body)
		throw new ApiError(
			502,
			"INVALID_UPSTREAM_RESPONSE",
			"The service returned no data.",
		);
	const reader = response.body.getReader(),
		chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > max) {
				await reader.cancel();
				throw new ApiError(
					502,
					"INVALID_UPSTREAM_RESPONSE",
					"The service returned an oversized response.",
				);
			}
			chunks.push(value);
		}
		const joined = new Uint8Array(size);
		let offset = 0;
		for (const c of chunks) {
			joined.set(c, offset);
			offset += c.length;
		}
		return JSON.parse(new TextDecoder().decode(joined));
	} catch (error) {
		if (error instanceof ApiError) throw error;
		throw new ApiError(
			502,
			"INVALID_UPSTREAM_RESPONSE",
			"The service returned unreadable data.",
		);
	} finally {
		reader.releaseLock();
	}
}
