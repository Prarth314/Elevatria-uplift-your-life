import { normalizeImageData } from "./images";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "./model.ts";
import { parseBackup } from "./portability.ts";
import { Editor } from "./Editors";
export function BackupTools({
	save,
	workspace,
}: {
	workspace: Workspace;
	save: (workspace: Workspace, message?: string) => boolean;
}) {
	const current = useRef(workspace);
	current.current = workspace;
	const base = useRef(workspace);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, []);
	const [pending, setPending] = useState<Workspace | null>(null),
		[error, setError] = useState(""),
		[reading, setReading] = useState(false);
	async function read(file?: File) {
		if (!file) return;
		const started = workspace;
		base.current = started;
		setReading(true);
		setError("");
		try {
			if (file.size > 8_000_000)
				throw Error("Choose a JSON backup under 8 MB.");
			const parsed = parseBackup(await file.text());
			for (const item of parsed.items)
				if (item.image) item.image = await normalizeImageData(item.image);
			if (!active.current) return;
			if (current.current !== started)
				throw Error(
					"Your board changed while reading the backup. Choose it again to review against the latest board.",
				);
			setPending(parsed);
		} catch (e) {
			if (!active.current) return;
			setError(e instanceof Error ? e.message : "The file could not be read.");
		} finally {
			if (active.current) setReading(false);
		}
	}
	return (
		<section className="backup-tools" aria-label="Restore your board">
			<div>
				<h3>Your plans belong to you.</h3>
				<p>
					Restore an exported JSON board after reviewing its contents. Import
					replaces the current board; export it first to keep a copy.
				</p>
			</div>
			<label className="quiet-button">
				{reading ? "Reading backup…" : "Choose JSON backup"}
				<input
					className="sr-only"
					type="file"
					accept="application/json,.json"
					disabled={reading}
					onChange={(e) => {
						void read(e.target.files?.[0]);
						e.target.value = "";
					}}
				/>
			</label>
			{error && (
				<p role="alert" className="error-text">
					{error}
				</p>
			)}
			{pending && (
				<Editor
					title="Review backup restoration"
					description="This replaces the current board, goals, progress, and planning history. Embedded images are re-encoded to remove metadata. Reimporting the same file replaces the board rather than duplicating it."
					close={() => setPending(null)}
				>
					<p>
						Current board: {workspace.goals.length} goals,{" "}
						{workspace.items.length} inspiration items. Restoring replaces
						these; it does not merge boards. Dependencies and accepted history
						retain their IDs.
					</p>
					<dl className="import-summary">
						<div>
							<dt>Goals</dt>
							<dd>{pending.goals.length}</dd>
						</div>
						<div>
							<dt>Tasks</dt>
							<dd>
								{pending.goals.reduce(
									(n, g) =>
										n + g.milestones.reduce((s, m) => s + m.tasks.length, 0),
									0,
								)}
							</dd>
						</div>
						<div>
							<dt>Inspiration</dt>
							<dd>{pending.items.length}</dd>
						</div>
						<div>
							<dt>Accepted schedule</dt>
							<dd>
								{pending.planning?.accepted
									? "Included; review before using"
									: "None"}
							</dd>
						</div>
					</dl>
					<div className="editor-actions">
						<button className="quiet-button" onClick={() => setPending(null)}>
							Cancel
						</button>
						<button
							className="primary-button"
							onClick={() => {
								if (current.current !== base.current) {
									setError(
										"Your board changed since this preview. Cancel and choose the backup again; newer edits are preserved.",
									);
									return;
								}
								const applied = save(
									pending,
									"Backup restored. Existing IDs are preserved; no duplicates were created.",
								);
								if (applied) setPending(null);
								else
									setError(
										"The backup exceeds board limits. Your previous board is unchanged.",
									);
							}}
						>
							Replace board with backup
						</button>
					</div>
				</Editor>
			)}
		</section>
	);
}
