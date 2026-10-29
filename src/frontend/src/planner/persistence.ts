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
		if (
			raw.length > 8_000_000 ||
			new TextEncoder().encode(raw).length > 8_000_000
		)
			return {
				status: "error",
				message:
					"Saved data exceeds the supported size. Export a backup before starting a new board.",
			};
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
		const serialized = JSON.stringify(workspace);
		if (new TextEncoder().encode(serialized).length > 8_000_000)
			return "Board exceeds the 8 MB storage limit. Export your work and reduce images or history.";
		storage.setItem(WORKSPACE_KEY, serialized);
		return null;
	} catch {
		return "Changes are in memory only. Storage is full or unavailable. Retry saving or export your board before leaving.";
	}
}

/** The demo store must never receive an account workspace through retry/reset paths. */
export function saveLocalWorkspace(
	storage: StoragePort,
	workspace: Workspace,
	accountOwner: string | null,
): string | null {
	if (accountOwner !== null)
		return "Account data cannot be saved to the local demo. Use the cloud save control.";
	return saveWorkspace(storage, workspace);
}
