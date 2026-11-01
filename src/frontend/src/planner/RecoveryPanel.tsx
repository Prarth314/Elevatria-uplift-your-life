import { useState, useRef, useEffect } from "react";
import type { Workspace } from "./model.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import { computeSchedule } from "./worker-client.ts";
import { addDays } from "./time.ts";
export function RecoveryPanel({
	workspace,
	settings,
	onProposal,
	onInvalidate,
	disabled,
	onBusyChange,
}: {
	workspace: Workspace;
	settings: ScheduleSettings;
	onProposal: (next: Workspace, schedule: Schedule) => void;
	onInvalidate: () => void;
	disabled: boolean;
	onBusyChange: (busy: boolean) => void;
}) {
	const [reason, setReason] = useState("missed"),
		[goalId, setGoalId] = useState(workspace.goals[0]?.id ?? ""),
		[amount, setAmount] = useState(7),
		[taskId, setTaskId] = useState(""),
		[minutes, setMinutes] = useState(60),
		[hours, setHours] = useState(2),
		[protectedIds, setProtected] = useState<string[]>([]),
		[busy, setBusy] = useState(false),
		[error, setError] = useState("");
	const request = useRef<AbortController | null>(null);
	useEffect(() => () => request.current?.abort(), []);
	useEffect(() => {
		request.current?.abort();
	}, [workspace, settings]);
	useEffect(() => {
		setProtected([]);
		setGoalId((id) =>
			workspace.goals.some((g) => g.id === id)
				? id
				: (workspace.goals[0]?.id ?? ""),
		);
	}, [workspace]);
	const accepted = workspace.planning?.accepted;
	const tasks = workspace.goals.flatMap((g) =>
		g.milestones.flatMap((m) => m.tasks),
	);
	async function recover() {
		if (request.current) return;
		const controller = new AbortController();
		request.current = controller;
		setBusy(true);
		onBusyChange(true);
		setError("");
		try {
			if (!accepted) throw Error("Accept an initial schedule first.");
			if (
				reason === "hours" &&
				(!Number.isFinite(hours) || hours < 0.5 || hours > 80)
			)
				throw Error("Weekly hours must be between 0.5 and 80.");
			if (
				reason === "deadline" &&
				(!Number.isInteger(amount) ||
					amount === 0 ||
					amount < -365 ||
					amount > 365)
			)
				throw Error(
					"Move the deadline by -365 to 365 whole days, excluding zero.",
				);
			if (
				reason === "effort" &&
				(!Number.isInteger(minutes) || minutes < 5 || minutes > 480)
			)
				throw Error("Task effort must be 5–480 whole minutes.");
			if (
				["hours", "deadline"].includes(reason) &&
				!workspace.goals.some((g) => g.id === goalId)
			)
				throw Error("Choose a goal.");
			if (
				reason === "effort" &&
				!tasks.some((t) => t.id === taskId && !t.completed)
			)
				throw Error("Choose an unfinished task.");
			const next: Workspace = {
				...workspace,
				goals: workspace.goals.map((g) => ({
					...g,
					...(g.id === goalId && reason === "hours"
						? { weeklyHours: hours }
						: {}),
					...(g.id === goalId && reason === "deadline"
						? { targetDate: addDays(g.targetDate, amount) }
						: {}),
					milestones: g.milestones.map((m) => ({
						...m,
						tasks: m.tasks.map((t) =>
							t.id === taskId && reason === "effort" ? { ...t, minutes } : t,
						),
					})),
				})),
			};
			const schedule = await computeSchedule(
				next,
				settings,
				controller.signal,
				{ previous: accepted, protectedTaskIds: protectedIds },
			);
			if (!controller.signal.aborted) onProposal(next, schedule);
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") {
				setError("Recovery cancelled. Accepted plan unchanged.");
				return;
			}
			setError(
				e instanceof Error
					? e.message
					: "Recovery failed. Your accepted plan is unchanged.",
			);
		} finally {
			request.current = null;
			setBusy(false);
			onBusyChange(false);
		}
	}
	return (
		<details
			className="scenario-panel"
			onChange={() => {
				request.current?.abort();
				onInvalidate();
			}}
		>
			<summary>My week changed</summary>
			<p>
				Find a way back without starting over. Nothing changes until you accept
				the proposal. Missed work remains unfinished; it is never automatically
				marked complete.
			</p>
			<label>
				What changed?
				<select value={reason} onChange={(e) => setReason(e.target.value)}>
					<option value="missed">I missed work or need a restart</option>
					<option value="availability">My availability changed</option>
					<option value="hours">I have less time for a goal</option>
					<option value="effort">A task needs more time</option>
					<option value="deadline">My deadline needs to move</option>
				</select>
			</label>
			{reason === "availability" && (
				<p>
					Edit the work windows or fixed commitments above, then generate
					recovery here. Unsaved availability is included in the proposal; it is
					applied only on acceptance.
				</p>
			)}
			{["hours", "deadline"].includes(reason) && (
				<label>
					Goal to adjust
					<select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
						{workspace.goals.map((g) => (
							<option key={g.id} value={g.id}>
								{g.title}
							</option>
						))}
					</select>
				</label>
			)}
			{reason === "hours" && (
				<label>
					New weekly hours
					<input
						type="number"
						min="0.5"
						max="80"
						step="0.5"
						value={hours}
						onChange={(e) => setHours(Number(e.target.value))}
					/>
				</label>
			)}
			{reason === "deadline" && (
				<label>
					Move deadline by days (negative moves earlier)
					<input
						type="number"
						min="-365"
						max="365"
						step="1"
						value={amount}
						onChange={(e) => setAmount(Number(e.target.value))}
					/>
				</label>
			)}
			{reason === "effort" && (
				<>
					<label>
						Task to re-estimate
						<select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
							<option value="">Choose an unfinished task</option>
							{tasks
								.filter((t) => !t.completed)
								.map((t) => (
									<option key={t.id} value={t.id}>
										{t.title}
									</option>
								))}
						</select>
					</label>
					<label>
						New total task estimate (minutes)
						<input
							type="number"
							min="5"
							max="480"
							value={minutes}
							onChange={(e) => setMinutes(Number(e.target.value))}
						/>
					</label>
				</>
			)}
			<fieldset className="dependency-editor">
				<legend>Protect existing task sessions for this recovery</legend>
				<p>
					All sessions for selected tasks stay fixed. Partly missed, completed,
					or re-estimated work must be unprotected. Conflicts are reported
					rather than silently moving protected work.
				</p>
				{tasks
					.filter(
						(t) =>
							!t.completed && accepted?.sessions.some((s) => s.taskId === t.id),
					)
					.map((t) => (
						<label key={t.id}>
							<input
								type="checkbox"
								checked={protectedIds.includes(t.id)}
								onChange={(e) =>
									setProtected(
										e.target.checked
											? [...protectedIds, t.id]
											: protectedIds.filter((id) => id !== t.id),
									)
								}
							/>
							{t.title}
						</label>
					))}
			</fieldset>
			{error && (
				<p role="alert" className="storage-alert">
					{error}
				</p>
			)}
			<button
				className="primary-button"
				disabled={!accepted || busy || disabled}
				onClick={recover}
			>
				{busy ? "Finding a repair…" : "Review a recovery plan"}
			</button>
			{busy && (
				<button
					className="quiet-button"
					onClick={() => request.current?.abort()}
				>
					Cancel recovery
				</button>
			)}
			{!accepted && (
				<p>Generate and accept your first schedule to enable recovery.</p>
			)}
		</details>
	);
}
