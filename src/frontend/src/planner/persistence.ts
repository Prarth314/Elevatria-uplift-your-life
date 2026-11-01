import { validWorkspace } from "./model.ts";
import type { Workspace } from "./model.ts";
export const WORKSPACE_KEY = "elevatria.workspace.v1";
export interface StoragePort {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}
/** Best-effort lost-update guard, including the interval before a storage event arrives.
 * A single setItem is atomic, but compare + write is not a cross-tab transaction.
 */
export function guardedStorage(storage: StoragePort): StoragePort {
	let observed = false;
	let expected: string | null = null;
	return {
		getItem(key) {
			const raw = storage.getItem(key);
			if (key === WORKSPACE_KEY) {
				expected = raw;
				observed = true;
			}
			return raw;
		},
		setItem(key, value) {
			if (
				key === WORKSPACE_KEY &&
				(!observed || storage.getItem(key) !== expected)
			)
				throw new StorageConflict();
			storage.setItem(key, value);
			if (key === WORKSPACE_KEY) expected = value;
		},
	};
}
export class StorageConflict extends Error {
	constructor() {
		super(
			"The saved board changed in another tab. Export your working board, then reload before saving. Newer saved work was not overwritten.",
		);
	}
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
	} catch (error) {
		if (error instanceof StorageConflict) return error.message;
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

export interface WriteLock {
	request<T>(name: string, operation: () => T | Promise<T>): Promise<T>;
}
/** All browser demo writers use the same origin-scoped Web Lock. The raw-value
 * guard remains necessary: a tab that read an older board must not overwrite it.
 * Undefined means a superseded request; it must not update current UI status.
 */
export async function saveCoordinatedLocalWorkspace(
	storage: StoragePort,
	workspace: Workspace,
	accountOwner: string | null,
	lock: WriteLock | undefined,
	isCurrent: () => boolean,
	replace = false,
): Promise<string | null | undefined> {
	if (accountOwner !== null)
		return "Account data cannot be saved to the local demo. Use the cloud save control.";
	if (!lock)
		return "Changes are in memory only. This browser cannot coordinate safe saves between tabs. Export your board before leaving or use a browser with Web Locks over HTTPS/localhost.";
	try {
		return await lock.request(WORKSPACE_KEY, () => {
			if (!isCurrent()) return undefined;
			// A user-reviewed reset may replace the latest saved board.
			if (replace) storage.getItem(WORKSPACE_KEY);
			return saveLocalWorkspace(storage, workspace, null);
		});
	} catch {
		return "Changes are in memory only. Safe browser saving failed. Retry or export your board before leaving.";
	}
}
