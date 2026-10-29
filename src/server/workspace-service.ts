import { validWorkspace } from "../frontend/src/planner/model.ts";
import type { Workspace } from "../frontend/src/planner/model.ts";
export interface CloudDocument {
	revision: number;
	workspace: Workspace;
}
export interface WorkspaceRepository {
	read(ownerId: string): Promise<CloudDocument | null>;
	write(
		ownerId: string,
		revision: number,
		workspace: Workspace,
	): Promise<CloudDocument | null>;
	remove(ownerId: string, revision: number): Promise<boolean>;
}
export class ApiError extends Error {
	status: number;
	code: string;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}
export interface RequestInput {
	method: string;
	token: string;
	body?: unknown;
}
export interface ServiceDependencies {
	authenticate: (token: string) => Promise<string | null>;
	repository: WorkspaceRepository;
}
export async function workspaceRequest(
	request: RequestInput,
	dependencies: ServiceDependencies,
): Promise<CloudDocument | { deleted: true }> {
	if (!["GET", "PUT", "DELETE"].includes(request.method))
		throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use GET, PUT, or DELETE.");
	if (!request.token || request.token.length > 8192)
		throw new ApiError(
			401,
			"AUTH_REQUIRED",
			"Sign in before accessing cloud data.",
		);
	const ownerId = await dependencies.authenticate(request.token);
	if (!ownerId)
		throw new ApiError(
			401,
			"AUTH_REQUIRED",
			"Your session is invalid or expired. Sign in again.",
		);
	if (request.method === "GET") {
		const document = await dependencies.repository.read(ownerId);
		if (!document)
			throw new ApiError(
				404,
				"NOT_FOUND",
				"This account has no cloud board yet.",
			);
		return document;
	}
	const body = request.body;
	if (!body || typeof body !== "object" || Array.isArray(body))
		throw new ApiError(400, "INVALID_REQUEST", "Expected a JSON object.");
	const data = body as Record<string, unknown>;
	const allowed =
		request.method === "PUT"
			? ["expectedRevision", "workspace"]
			: ["expectedRevision"];
	if (
		Object.keys(data).some((key) => !allowed.includes(key)) ||
		!Number.isSafeInteger(data.expectedRevision) ||
		(data.expectedRevision as number) < 0
	)
		throw new ApiError(
			400,
			"INVALID_REQUEST",
			"Provide an expected revision and no ownership fields.",
		);
	if (request.method === "DELETE") {
		if (
			!(await dependencies.repository.remove(
				ownerId,
				data.expectedRevision as number,
			))
		)
			throw new ApiError(
				409,
				"REVISION_CONFLICT",
				"Cloud data changed. Load the latest revision before deleting.",
			);
		return { deleted: true };
	}
	if (!validWorkspace(data.workspace))
		throw new ApiError(
			422,
			"INVALID_WORKSPACE",
			"The board has invalid data, dependencies, or planning history.",
		);
	if (
		new TextEncoder().encode(JSON.stringify(data.workspace)).length > 1_000_000
	)
		throw new ApiError(
			413,
			"BOARD_TOO_LARGE",
			"Cloud boards are limited to 1 MB. Export a backup and reduce embedded images or history.",
		);
	const document = await dependencies.repository.write(
		ownerId,
		data.expectedRevision as number,
		data.workspace,
	);
	if (!document)
		throw new ApiError(
			409,
			"REVISION_CONFLICT",
			"Cloud data changed. Export your local work, then load and review the latest cloud revision.",
		);
	return document;
}
