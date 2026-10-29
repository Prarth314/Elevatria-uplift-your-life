import {
	serviceUrl,
	publicKey,
} from "../frontend/src/planner/service-config.ts";
import { limitedJson } from "./security.ts";
import { ApiError } from "./workspace-service.ts";
import type {
	CloudDocument,
	WorkspaceRepository,
} from "./workspace-service.ts";
import type { Workspace } from "../frontend/src/planner/model.ts";
import { validWorkspace } from "../frontend/src/planner/model.ts";
export interface ServerConfig {
	url: string;
	publishableKey: string;
	secretKey: string;
}
export function cloudConfig(): ServerConfig | null {
	const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
	const publishableKey =
		process.env.SUPABASE_PUBLISHABLE_KEY ??
		process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
	const secretKey = process.env.SUPABASE_SECRET_KEY;
	if (!url || !publishableKey || !secretKey) return null;
	const origin = serviceUrl(url, process.env.NODE_ENV !== "production");
	if (!origin || !publicKey(publishableKey)) return null;
	return { url: origin, publishableKey, secretKey };
}
export function supabaseDependencies(
	config: ServerConfig,
	fetcher: typeof fetch = fetch,
) {
	async function call(path: string, init: RequestInit = {}) {
		const headers: Record<string, string> = {
			apikey: config.secretKey,
			"Content-Type": "application/json",
		};
		// Legacy service-role JWTs require Authorization; new secret keys use the API gateway.
		if (!config.secretKey.startsWith("sb_secret_"))
			headers.Authorization = `Bearer ${config.secretKey}`;
		let response: Response;
		try {
			response = await fetcher(`${config.url}${path}`, {
				...init,
				redirect: "error",
				headers,
				signal: AbortSignal.timeout(8000),
			});
		} catch {
			throw new ApiError(
				503,
				"CLOUD_UNAVAILABLE",
				"Cloud storage is unreachable. Local work has not been replaced.",
			);
		}
		if (!response.ok) {
			const problem = (await limitedJson(response, 16384).catch(
				() => null,
			)) as { message?: unknown } | null;
			if (problem?.message === "RATE_LIMITED")
				throw new ApiError(
					429,
					"RATE_LIMITED",
					"Too many cloud requests. Wait one minute and retry.",
				);
			throw new ApiError(
				503,
				"CLOUD_UNAVAILABLE",
				"Cloud storage is unavailable or its migration is missing. Retry later.",
			);
		}
		return limitedJson(response);
	}
	function document(value: unknown): CloudDocument {
		const row = value as { revision: unknown; document: unknown };
		if (
			!row ||
			!Number.isSafeInteger(row.revision) ||
			(row.revision as number) < 1 ||
			!validWorkspace(row.document)
		)
			throw new ApiError(
				502,
				"INVALID_CLOUD_DATA",
				"Cloud data could not be validated. Existing local work is unchanged.",
			);
		return { revision: row.revision as number, workspace: row.document };
	}
	const repository: WorkspaceRepository = {
		async read(ownerId) {
			const rows = await call("/rest/v1/rpc/read_workspace", {
				method: "POST",
				body: JSON.stringify({ p_owner: ownerId }),
			});
			if (!Array.isArray(rows) || rows.length > 1)
				throw new ApiError(
					502,
					"INVALID_CLOUD_DATA",
					"Cloud response could not be validated.",
				);
			return rows[0] ? document(rows[0]) : null;
		},
		async write(ownerId, revision, workspace: Workspace) {
			const rows = await call("/rest/v1/rpc/save_workspace", {
				method: "POST",
				body: JSON.stringify({
					p_owner: ownerId,
					p_revision: revision,
					p_document: workspace,
				}),
			});
			if (!Array.isArray(rows) || rows.length > 1)
				throw new ApiError(
					502,
					"INVALID_CLOUD_DATA",
					"Cloud response could not be validated.",
				);
			return rows[0] ? document(rows[0]) : null;
		},
		async remove(ownerId, revision) {
			const result = await call("/rest/v1/rpc/delete_workspace", {
				method: "POST",
				body: JSON.stringify({ p_owner: ownerId, p_revision: revision }),
			});
			if (typeof result !== "boolean")
				throw new ApiError(
					502,
					"INVALID_CLOUD_DATA",
					"Cloud response could not be validated.",
				);
			return result;
		},
	};
	return {
		repository,
		authenticate: async (token: string): Promise<string | null> => {
			let response: Response;
			try {
				response = await fetcher(`${config.url}/auth/v1/user`, {
					redirect: "error",
					headers: {
						apikey: config.publishableKey,
						Authorization: `Bearer ${token}`,
					},
					signal: AbortSignal.timeout(8000),
				});
			} catch {
				throw new ApiError(
					503,
					"AUTH_UNAVAILABLE",
					"Identity verification is unavailable. Try again later.",
				);
			}
			if (response.status === 401 || response.status === 403) {
				await response.body?.cancel();
				return null;
			}
			if (!response.ok) {
				await response.body?.cancel();
				throw new ApiError(
					503,
					"AUTH_UNAVAILABLE",
					"Identity verification is unavailable.",
				);
			}
			const user = (await limitedJson(response, 65536)) as {
				id?: unknown;
				is_anonymous?: unknown;
				app_metadata?: { providers?: unknown };
			};
			if (
				!user ||
				typeof user !== "object" ||
				user.is_anonymous === true ||
				!Array.isArray(user.app_metadata?.providers) ||
				!user.app_metadata.providers.includes("github")
			)
				return null;
			return typeof user.id === "string" &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					user.id,
				)
				? user.id
				: null;
		},
	};
}
