import { useState } from "react";
import type { Workspace } from "./model.ts";
import { parseBackup } from "./portability.ts";
import { Editor } from "./Editors";
export function BackupTools({
	save,
}: { save: (workspace: Workspace, message?: string) => void }) {
	const [pending, setPending] = useState<Workspace | null>(null),
		[error, setError] = useState(""),
		[reading, setReading] = useState(false);
	async function read(file?: File) {
		if (!file) return;
		setReading(true);
		setError("");
		try {
			if (file.size > 8_000_000)
				throw Error("Choose a JSON backup under 8 MB.");
			setPending(parseBackup(await file.text()));
		} catch (e) {
			setError(e instanceof Error ? e.message : "The file could not be read.");
		} finally {
			setReading(false);
		}
	}
	return (
		<section className="backup-tools" aria-label="Restore your board">
			<div>
				<h3>Your plans belong to you.</h3>
				<p>
					Restore an exported JSON board after reviewing its contents. Import
					replaces this browser’s current board; export it first to keep a copy.
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
					description="This replaces the current board, goals, progress, and planning history. Reimporting the same file replaces the board rather than duplicating it."
					close={() => setPending(null)}
				>
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
								save(
									pending,
									"Backup restored. Existing IDs are preserved; no duplicates were created.",
								);
								setPending(null);
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
