import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import type { Workspace } from "./model.ts";
import { validWorkspace } from "./model.ts";
import { Editor } from "./Editors";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
function publicConfigValid() {
	if (!url || !key) return false;
	try {
		const parsed = new URL(url);
		if (
			parsed.protocol !== "https:" &&
			!["localhost", "127.0.0.1"].includes(parsed.hostname)
		)
			return false;
		if (key.startsWith("sb_publishable_")) return true;
		if (key.split(".").length === 3)
			return (
				JSON.parse(
					atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
				).role === "anon"
			);
	} catch {
		return false;
	}
	return false;
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
	const epoch = useRef(0),
		activeUser = useRef<string | null>(null),
		leaveRef = useRef(onLeave);
	leaveRef.current = onLeave;
	useEffect(() => {
		if (!publicConfigValid()) return;
		let cancelled = false,
			unsubscribe: (() => void) | undefined;
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
				setClient(instance);
				const apply = (next: Session | null) => {
					if (cancelled) return;
					const id = next?.user.id ?? null;
					if (activeUser.current !== id) {
						epoch.current++;
						activeUser.current = id;
						setRevision(null);
						setPending(null);
						setConfirmation(null);
						leaveRef.current();
					}
					setSession(next);
				};
				const { data } = instance.auth.onAuthStateChange((_event, next) =>
					apply(next),
				);
				unsubscribe = () => data.subscription.unsubscribe();
				const result = await instance.auth.getSession();
				if (result.error) throw result.error;
				apply(result.data.session);
			} catch {
				if (!cancelled)
					setError(
						"Sign-in could not initialize. Local planning is still available.",
					);
			}
		})();
		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);
	async function api(method: string, body?: unknown) {
		if (!session) throw Error("Sign in before accessing cloud data.");
		const response = await fetch("/api/workspace", {
			method,
			headers: {
				Authorization: `Bearer ${session.access_token}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(12000),
		});
		const data = await response.json().catch(() => null);
		if (!response.ok)
			throw Error(
				data?.error?.message ??
					`Cloud request failed (${response.status}). Local work is unchanged.`,
			);
		return data;
	}
	async function run(operation: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			await operation();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Cloud request failed. Try again.",
			);
		} finally {
			setBusy(false);
		}
	}
	async function load() {
		const version = epoch.current,
			id = session?.user.id;
		if (!id) return;
		const data = await api("GET");
		if (version !== epoch.current) return;
		if (!Number.isSafeInteger(data.revision) || !validWorkspace(data.workspace))
			throw Error("Cloud data is invalid. Your current board is unchanged.");
		setRevision(data.revision);
		setPending({ ...data, owner: id });
	}
	async function upload() {
		const version = epoch.current,
			id = session?.user.id;
		if (!id) return;
		const data = await api("PUT", {
			expectedRevision: revision ?? 0,
			workspace,
		});
		if (version !== epoch.current) return;
		if (!Number.isSafeInteger(data.revision) || !validWorkspace(data.workspace))
			throw Error(
				"Cloud response is invalid. Reload cloud status before retrying.",
			);
		setRevision(data.revision);
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
					Account sign-in is not configured for this installation. All planning,
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
					<button
						className="primary-button"
						disabled={!client || busy}
						onClick={() =>
							void run(async () => {
								const result = await client!.auth.signInWithOAuth({
									provider: "github",
									options: { redirectTo: window.location.origin + "/" },
								});
								if (result.error)
									throw Error(
										"GitHub sign-in could not start. Check the configured OAuth provider and redirect URLs.",
									);
							})
						}
					>
						Sign in with GitHub
					</button>
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
									epoch.current++;
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
										const version = epoch.current;
										await api("DELETE", { expectedRevision: revision });
										if (version !== epoch.current) return;
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
