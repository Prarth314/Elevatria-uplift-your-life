import { normalizeImageData } from "./images";
import { configuredPublicKey, publicKey, serviceUrl } from "./service-config";
import { CloudEpoch, mayReplaceAfterSave } from "./cloud-state";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { Workspace, VisionItem } from "./model.ts";
import { validWorkspace } from "./model.ts";
import { Editor } from "./Editors";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = configuredPublicKey(
	import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
	import.meta.env.VITE_SUPABASE_ANON_KEY,
);
function publicConfigValid() {
	return !!serviceUrl(url, import.meta.env.DEV) && publicKey(key);
}
export default function CloudPanel({
	workspace,
	owner,
	onLoad,
	onLeave,
}: {
	workspace: Workspace;
	owner: string | null;
	onLoad: (workspace: Workspace, owner: string) => void;
	onLeave: () => void;
}) {
	const [client, setClient] = useState<SupabaseClient | null>(null),
		[session, setSession] = useState<Session | null>(null);
	const [busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState("");
	const [revision, setRevision] = useState<number | null>(null);
	const [pending, setPending] = useState<{
		revision: number;
		workspace: Workspace;
		owner: string;
	} | null>(null);
	const [confirmation, setConfirmation] = useState<"upload" | "delete" | null>(
		null,
	);
	const epoch = useRef(new CloudEpoch()),
		activeUser = useRef<string | null>(null),
		leaveRef = useRef(onLeave);
	leaveRef.current = onLeave;
	const workspaceRef = useRef(workspace);
	workspaceRef.current = workspace;
	const running = useRef(false);
	useEffect(() => {
		if (!publicConfigValid()) return;
		let cancelled = false,
			unsubscribe: (() => void) | undefined;
		let stopRefresh: (() => void) | undefined;
		let authEvents = 0;
		void (async () => {
			try {
				const { createClient } = await import("@supabase/supabase-js");
				if (cancelled) return;
				const instance = createClient(url!, key!, {
					auth: {
						flowType: "pkce",
						storage: window.sessionStorage,
						persistSession: true,
						autoRefreshToken: true,
						detectSessionInUrl: true,
					},
				});
				stopRefresh = () => instance.auth.stopAutoRefresh();
				setClient(instance);
				const apply = (next: Session | null) => {
					if (cancelled) return;
					const id = next?.user.id ?? null;
					if (activeUser.current !== id) {
						epoch.current.next();
						activeUser.current = id;
						setRevision(null);
						setPending(null);
						setConfirmation(null);
						leaveRef.current();
					}
					setSession(next);
				};
				const { data } = instance.auth.onAuthStateChange((_event, next) => {
					authEvents++;
					apply(next);
				});
				unsubscribe = () => data.subscription.unsubscribe();
				const eventsBefore = authEvents;
				const result = await instance.auth.getSession();
				if (result.error) throw result.error;
				if (eventsBefore === authEvents) apply(result.data.session);
			} catch {
				if (!cancelled)
					setError(
						"Sign-in could not initialize. Local planning is still available.",
					);
			}
		})();
		return () => {
			cancelled = true;
			epoch.current.next();
			stopRefresh?.();
			unsubscribe?.();
		};
	}, []);
	async function api(method: string, body?: unknown) {
		if (!session) throw Error("Sign in before accessing cloud data.");
		const requestEpoch = epoch.current.current();
		const response = await fetch("/api/workspace", {
			method,
			headers: {
				Authorization: `Bearer ${session.access_token}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(12000),
		});
		const reader = response.body?.getReader();
		if (!reader) throw Error("Cloud returned an empty response.");
		const chunks: Uint8Array[] = [];
		let bytes = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				if (bytes > 1_100_000) {
					await reader.cancel();
					throw Error("Cloud returned too much data. Your board is unchanged.");
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
		const joined = new Uint8Array(bytes);
		let offset = 0;
		for (const chunk of chunks) {
			joined.set(chunk, offset);
			offset += chunk.length;
		}
		let data;
		try {
			data = JSON.parse(new TextDecoder().decode(joined));
		} catch {
			throw Error("Cloud returned unreadable data. Try again later.");
		}
		if (
			response.status === 401 &&
			epoch.current.matches(requestEpoch) &&
			activeUser.current === session.user.id
		) {
			epoch.current.next();
			activeUser.current = null;
			setSession(null);
			setRevision(null);
			setPending(null);
			setConfirmation(null);
			leaveRef.current();
			void client?.auth.signOut({ scope: "local" }).catch(() => {});
			throw Error(
				"Your session expired. The local demo was restored. Sign in again to access your account.",
			);
		}
		if (!response.ok)
			throw Error(
				(typeof data?.error?.message === "string" &&
				data.error.message.length < 500
					? data.error.message
					: null) ??
					`Cloud request failed (${response.status}). Local work is unchanged.`,
			);
		return data;
	}
	async function run(operation: () => Promise<void>) {
		if (running.current) return;
		running.current = true;
		setBusy(true);
		setError("");
		try {
			await operation();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Cloud request failed. Try again.",
			);
		} finally {
			running.current = false;
			setBusy(false);
		}
	}
	async function load() {
		const version = epoch.current.current(),
			id = session?.user.id;
		if (!id) return;
		const data = await api("GET");
		if (!epoch.current.matches(version)) return;
		if (!Number.isSafeInteger(data.revision) || !validWorkspace(data.workspace))
			throw Error("Cloud data is invalid. Your current board is unchanged.");
		setRevision(data.revision);
		setPending({ ...data, owner: id });
	}
	async function upload() {
		const version = epoch.current.current(),
			id = session?.user.id;
		if (!id) return;
		const submitted = workspace;
		const items: VisionItem[] = [];
		for (const item of submitted.items) {
			if (!epoch.current.matches(version)) return;
			items.push(
				item.image
					? { ...item, image: await normalizeImageData(item.image) }
					: item,
			);
		}
		if (!epoch.current.matches(version)) return;
		const sanitized = { ...submitted, items };
		const data = await api("PUT", {
			expectedRevision: revision ?? 0,
			workspace: sanitized,
		});
		if (!epoch.current.matches(version)) return;
		if (!Number.isSafeInteger(data.revision) || !validWorkspace(data.workspace))
			throw Error(
				"Cloud response is invalid. Reload cloud status before retrying.",
			);
		setRevision(data.revision);
		if (!mayReplaceAfterSave(submitted, workspaceRef.current)) {
			setMessage(
				"An earlier snapshot was saved. Newer edits remain in memory; save again to include them.",
			);
			return;
		}
		onLoad(data.workspace, id);
		setMessage(
			`Saved to your account at revision ${data.revision}. Account data stays in memory in this tab; it is not copied into the demo browser store.`,
		);
	}
	if (!publicConfigValid())
		return (
			<section className="cloud-panel">
				<div className="eyebrow">OPTIONAL ACCOUNT STORAGE</div>
				<h3>Local by default. Cloud when configured.</h3>
				<p>
					Google and GitHub sign-in are not configured yet. All planning,
					scheduling, scenarios, and file exports work locally without an
					account or paid API.
				</p>
				<p>
					Developer setup: <code>docs/CLOUD_SETUP.md</code>. Never put a secret
					key in a VITE_ variable.
				</p>
			</section>
		);
	return (
		<section className="cloud-panel" aria-label="Account storage">
			<div className="eyebrow">OPTIONAL ACCOUNT STORAGE</div>
			<h3>
				{session ? "Your account, your board." : "Keep a board across devices."}
			</h3>
			<p>
				{owner
					? "Account board is in memory. Save changes explicitly to cloud. Signing out returns to the separate local demo."
					: "You are viewing the local demo. Sign-in does not automatically upload or replace it."}
			</p>
			{error && (
				<p className="storage-alert" role="alert">
					{error}
				</p>
			)}
			<p role="status">{busy ? "Working…" : message}</p>
			<div className="schedule-actions">
				{!session ? (
					(["google", "github"] as const).map((provider) => (
						<button
							key={provider}
							className="primary-button"
							disabled={!client || busy}
							onClick={() =>
								void run(async () => {
									const result = await client!.auth.signInWithOAuth({
										provider,
										options: {
											redirectTo: window.location.origin + "/",
											...(provider === "google"
												? { queryParams: { prompt: "select_account" } }
												: {}),
										},
									});
									if (result.error)
										throw Error(
											"Sign-in could not start. Check the configured provider and redirect URLs, then retry.",
										);
								})
							}
						>
							{provider === "google"
								? "Continue with Google"
								: "Continue with GitHub"}
						</button>
					))
				) : (
					<>
						<button
							className="quiet-button"
							disabled={busy}
							onClick={() => void run(load)}
						>
							Load cloud board
						</button>
						<button
							className="primary-button"
							disabled={busy}
							onClick={() => setConfirmation("upload")}
						>
							{owner ? "Save cloud board" : "Copy this board to cloud"}
						</button>
						<button
							className="quiet-button"
							disabled={busy}
							onClick={() =>
								void run(async () => {
									const result = await client!.auth.signOut({ scope: "local" });
									if (result.error) throw Error("Sign-out failed. Try again.");
									epoch.current.next();
									activeUser.current = null;
									setSession(null);
									setRevision(null);
									setPending(null);
									onLeave();
									setMessage("Signed out. Local demo restored.");
								})
							}
						>
							Sign out of this tab
						</button>
						{revision !== null && (
							<button
								className="quiet-button"
								disabled={busy}
								onClick={() => setConfirmation("delete")}
							>
								Delete cloud board
							</button>
						)}
					</>
				)}
			</div>
			{pending && (
				<Editor
					title="Open your cloud board?"
					description="This replaces the in-memory view, not the separate local demo. Export any unsaved work first."
					close={() => setPending(null)}
				>
					<p>
						{pending.workspace.goals.length} goals · cloud revision{" "}
						{pending.revision}
					</p>
					<div className="editor-actions">
						<button className="quiet-button" onClick={() => setPending(null)}>
							Cancel
						</button>
						<button
							className="primary-button"
							onClick={() => {
								if (pending.owner !== session?.user.id) {
									setPending(null);
									return;
								}
								onLoad(pending.workspace, pending.owner);
								setPending(null);
								setMessage(
									"Cloud board loaded. Changes must be saved explicitly.",
								);
							}}
						>
							Open cloud board
						</button>
					</div>
				</Editor>
			)}
			{confirmation && (
				<Editor
					title={
						confirmation === "delete"
							? "Delete your cloud board?"
							: "Save this board to your account?"
					}
					description={
						confirmation === "delete"
							? "This permanently deletes the saved cloud board. Export a backup first. Your identity account remains."
							: "This replaces the account board at the last loaded revision. Conflicts are rejected rather than overwriting newer work."
					}
					close={() => setConfirmation(null)}
				>
					<div className="editor-actions">
						<button
							className="quiet-button"
							onClick={() => setConfirmation(null)}
						>
							Cancel
						</button>
						<button
							className="primary-button"
							disabled={busy}
							onClick={() => {
								const action = confirmation;
								setConfirmation(null);
								void run(async () => {
									if (action === "upload") await upload();
									else {
										const version = epoch.current.current();
										await api("DELETE", { expectedRevision: revision });
										if (!epoch.current.matches(version)) return;
										setRevision(null);
										setPending(null);
										onLeave();
										setMessage("Cloud board deleted. Local demo restored.");
									}
								});
							}}
						>
							{confirmation === "delete"
								? "Delete cloud board permanently"
								: "Save to cloud"}
						</button>
					</div>
				</Editor>
			)}
		</section>
	);
}
