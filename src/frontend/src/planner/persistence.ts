import { validWorkspace } from "./model.ts";
import type { Workspace } from "./model.ts";
export const WORKSPACE_KEY = "elevatria.workspace.v1";
export interface StoragePort {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}
export type LoadResult =
	| { status: "empty" }
	| { status: "ready"; workspace: Workspace }
	| { status: "error"; message: string };
export function loadWorkspace(storage: StoragePort): LoadResult {
	try {
		const raw = storage.getItem(WORKSPACE_KEY);
		if (raw === null) return { status: "empty" };
		const workspace: unknown = JSON.parse(raw);
		if (!validWorkspace(workspace))
			return {
				status: "error",
				message:
					"Saved data could not be validated. It has been left untouched. Export a backup before starting a new board.",
			};
		return { status: "ready", workspace };
	} catch {
		return {
			status: "error",
			message:
				"Saved data could not be read. Browser storage may be unavailable or damaged. Your existing data has not been overwritten.",
		};
	}
}
export function saveWorkspace(
	storage: StoragePort,
	workspace: Workspace,
): string | null {
	if (!validWorkspace(workspace))
		return "This change contains invalid data and could not be saved.";
	try {
		storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
		return null;
	} catch {
		return "Changes are in memory only. Storage is full or unavailable. Retry saving or export your board before leaving.";
	}
}
