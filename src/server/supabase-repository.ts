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
	try {
		const parsed = new URL(url);
		if (
			parsed.protocol !== "https:" &&
			!["localhost", "127.0.0.1"].includes(parsed.hostname)
		)
			return null;
	} catch {
		return null;
	}
	return { url: url.replace(/\/$/, ""), publishableKey, secretKey };
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
		if (!response.ok)
			throw new ApiError(
				503,
				"CLOUD_UNAVAILABLE",
				"Cloud storage is unavailable or its migration is missing. Retry later.",
			);
		return response.json();
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
			const rows = await call(
				`/rest/v1/workspaces?owner_id=eq.${encodeURIComponent(ownerId)}&select=revision,document&limit=1`,
			);
			return Array.isArray(rows) && rows[0] ? document(rows[0]) : null;
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
			return Array.isArray(rows) && rows[0] ? document(rows[0]) : null;
		},
		async remove(ownerId, revision) {
			const result = await call("/rest/v1/rpc/delete_workspace", {
				method: "POST",
				body: JSON.stringify({ p_owner: ownerId, p_revision: revision }),
			});
			return result === true;
		},
	};
	return {
		repository,
		authenticate: async (token: string): Promise<string | null> => {
			let response: Response;
			try {
				response = await fetcher(`${config.url}/auth/v1/user`, {
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
			if (response.status === 401 || response.status === 403) return null;
			if (!response.ok)
				throw new ApiError(
					503,
					"AUTH_UNAVAILABLE",
					"Identity verification is unavailable.",
				);
			const user = (await response.json()) as { id?: unknown };
			return typeof user.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id)
				? user.id
				: null;
		},
	};
}
