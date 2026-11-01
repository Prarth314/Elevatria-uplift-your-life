import {
	allocationSummary,
	placementFacts,
	unplacedExplanation,
} from "./explanations";
import { proposalErrors } from "./proposals";
import { RecoveryPanel } from "./RecoveryPanel";
import { computeSchedule } from "./worker-client";
import { useEffect, useState, useRef, useMemo } from "react";
import type { Workspace } from "./model.ts";
import { newId, localDate } from "./model.ts";
import { defaultSettings } from "./schedule-types.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import {
	inputRevision,
	scheduleDiff,
	scheduleViolations,
} from "./scheduler.ts";
import { settingsErrors } from "./schedule-validation.ts";
import { validTimezone } from "./time.ts";
import { addDays } from "./time.ts";
import { acceptedCalendarFile, downloadFile } from "./portability.ts";
const weekdays = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
export function SchedulePanel({
	workspace,
	save,
}: {
	workspace: Workspace;
	save: (workspace: Workspace, message?: string) => boolean;
}) {
	const [settings, setSettings] = useState<ScheduleSettings>(
		() => workspace.planning?.settings ?? defaultSettings(),
	);
	const [proposal, setProposal] = useState<Schedule | null>(null);
	const [recoveryDraft, setRecoveryDraft] = useState<Workspace | null>(null);
	const recoveryBase = useRef<Workspace | null>(null);
	const [undo, setUndo] = useState<{
		before: Workspace;
		after: Workspace;
	} | null>(null);
	const [scenario, setScenario] = useState<Schedule | null>(null);
	const [scenarioKind, setScenarioKind] = useState("half");
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [computing, setComputing] = useState(false);
	const [recovering, setRecovering] = useState(false);
	const computation = useRef<AbortController | null>(null);
	useEffect(() => () => computation.current?.abort(), []);
	useEffect(() => {
		setSettings(workspace.planning?.settings ?? defaultSettings());
		setProposal(null);
		setRecoveryDraft(null);
		setScenario(null);
	}, [workspace.planning?.settings]);
	useEffect(() => {
		computation.current?.abort();
		setProposal(null);
		setRecoveryDraft(null);
		setScenario(null);
	}, [workspace, settings]);
	const accepted = workspace.planning?.accepted;
	const revision = useMemo(
		() => inputRevision(workspace, settings),
		[workspace.goals, settings],
	);
	const stale = !!accepted && accepted.inputRevision !== revision;
	const dirty =
		JSON.stringify(settings) !==
		JSON.stringify(workspace.planning?.settings ?? defaultSettings());
	const changes = proposal ? scheduleDiff(accepted, proposal) : [];
	const summary = proposal ? allocationSummary(accepted, proposal) : null;
	function update(next: ScheduleSettings) {
		setSettings(next);
		setScenario(null);
		setMessage("Availability edits are not saved yet.");
	}
	function saveSettings() {
		const errors = settingsErrors(settings);
		if (errors.length) {
			setError(errors.join(" "));
			return;
		}
		const applied = save(
			{
				...workspace,
				planning: {
					...workspace.planning,
					settings,
					history: workspace.planning?.history ?? [],
				},
			},
			"Availability saved. Review a new schedule before replacing accepted sessions.",
		);
		if (!applied) {
			setError("Availability could not be applied. Review the board warning.");
			return;
		}
		setError("");
		setMessage(
			"Availability applied. Check the workspace save status; existing sessions remain unchanged.",
		);
	}
	async function generate() {
		if (computation.current) return;
		const controller = new AbortController();
		computation.current = controller;
		setComputing(true);
		try {
			if (dirty) throw Error("Save availability before generating a proposal.");
			setRecoveryDraft(null);
			const result = await computeSchedule(
				workspace,
				settings,
				controller.signal,
			);
			if (controller.signal.aborted) return;
			setProposal(result);
			setError("");
			setMessage("Proposal generated. Your accepted schedule has not changed.");
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") {
				setMessage("Computation cancelled. Accepted schedule unchanged.");
				return;
			}
			setError(
				e instanceof Error ? e.message : "Scheduling failed. Try again.",
			);
		} finally {
			if (computation.current === controller) computation.current = null;
			setComputing(false);
		}
	}
	function accept() {
		if (!proposal) return;
		const target = recoveryDraft ?? workspace;
		try {
			if (recoveryDraft && recoveryBase.current !== workspace)
				throw Error(
					"Your board changed after this recovery proposal. Generate recovery again to preserve newer edits.",
				);
			if (
				(dirty && !recoveryDraft) ||
				proposal.inputRevision !== inputRevision(target, settings)
			)
				throw Error(
					"This proposal is stale. Generate again using the latest goals and availability.",
				);
			const errors = proposalErrors(target, settings, proposal);
			if (errors.length) throw Error(errors.join(" "));
			const next: Workspace = {
				...target,
				planning: {
					settings,
					accepted: proposal,
					history: [
						...(accepted ? [accepted] : []),
						...(workspace.planning?.history ?? []),
					].slice(0, 10),
				},
			};
			const applied = save(
				next,
				"Schedule accepted. Previous accepted versions remain in history.",
			);
			if (!applied)
				throw Error(
					"The schedule exceeds board or history limits. Your previous schedule is unchanged.",
				);
			setUndo({ before: workspace, after: next });
			setRecoveryDraft(null);
			setProposal(null);
			setError("");
			setMessage(
				"Schedule accepted. Check the workspace save status to confirm persistence.",
			);
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") {
				setMessage("Computation cancelled. Accepted schedule unchanged.");
				return;
			}
			setError(e instanceof Error ? e.message : "Could not accept schedule.");
		}
	}
	async function compare() {
		if (computation.current) return;
		const controller = new AbortController();
		computation.current = controller;
		setComputing(true);
		try {
			if (dirty) throw Error("Save availability before comparing scenarios.");
			const variant: Workspace = {
				...workspace,
				goals: workspace.goals.map((g) =>
					scenarioKind === "half"
						? { ...g, weeklyHours: Math.max(0.5, g.weeklyHours / 2) }
						: { ...g, targetDate: addDays(g.targetDate, 7) },
				),
			};
			const result = await computeSchedule(
				variant,
				settings,
				controller.signal,
			);
			if (controller.signal.aborted) return;
			setScenario(result);
			setError("");
			setMessage(
				"Scenario only. Goals, dates, and accepted sessions remain unchanged.",
			);
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") {
				setMessage("Computation cancelled. Accepted schedule unchanged.");
				return;
			}
			setError(
				e instanceof Error ? e.message : "Scenario could not be computed.",
			);
		} finally {
			if (computation.current === controller) computation.current = null;
			setComputing(false);
		}
	}
	function exportCalendar() {
		try {
			if (!accepted || stale || dirty)
				throw Error(
					"Review and accept a schedule for the current plan before exporting.",
				);
			const errors = scheduleViolations(workspace, settings, accepted);
			if (errors.length) throw Error(errors.join(" "));
			downloadFile(
				acceptedCalendarFile(workspace),
				`elevatria-${localDate()}.ics`,
				"text/calendar;charset=utf-8",
			);
			setError("");
			setMessage(
				"Calendar downloaded. Import behavior, including updates, depends on your calendar application.",
			);
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") {
				setMessage("Computation cancelled. Accepted schedule unchanged.");
				return;
			}
			setError(e instanceof Error ? e.message : "Calendar export failed.");
		}
	}
	function renderSchedule(schedule: Schedule, source = workspace) {
		const format = new Intl.DateTimeFormat(undefined, {
			timeZone: validTimezone(settings.timezone) ? settings.timezone : "UTC",
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
		const duration = schedule.sessions.reduce(
			(sum, s) => sum + (Date.parse(s.end) - Date.parse(s.start)) / 60000,
			0,
		);
		return (
			<div className="schedule-result">
				<p className="schedule-stats">
					{schedule.sessions.length} sessions · {Math.round(duration / 6) / 10}{" "}
					hours placed ·{" "}
					{schedule.unscheduled.reduce((n, t) => n + t.remainingMinutes, 0)}{" "}
					minutes unplaced across {schedule.unscheduled.length} tasks
				</p>
				{schedule.warnings.map((w) => (
					<p className="schedule-warning" key={w}>
						{w}
					</p>
				))}
				{schedule.sessions.length === 0 && (
					<p className="empty-focus">
						No sessions fit. Add availability, reduce scope, adjust estimates or
						deadlines, and try another proposal.
					</p>
				)}
				<ol className="session-list">
					{schedule.sessions.slice(0, 100).map((s) => (
						<li key={s.id}>
							<span>
								{format.format(new Date(s.start))}
								<small>
									to{" "}
									{new Intl.DateTimeFormat(undefined, {
										timeZone: settings.timezone,
										hour: "numeric",
										minute: "2-digit",
									}).format(new Date(s.end))}
								</small>
							</span>
							<div>
								<strong>{s.title}</strong>
								<details className="placement-facts">
									<summary>Placement details</summary>
									{schedule.inputRevision ===
									inputRevision(source, settings) ? (
										<ul>
											{placementFacts(source, settings, schedule, s).map(
												(fact) => (
													<li key={fact}>{fact}</li>
												),
											)}
										</ul>
									) : (
										<p>
											Historical or changed inputs. Allocation times are
											preserved, but current constraints cannot explain this
											snapshot. Review a fresh proposal.
										</p>
									)}
								</details>
							</div>
							<span>
								{Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000)}m
							</span>
						</li>
					))}
				</ol>
				{schedule.sessions.length > 100 && (
					<p>
						Showing the first 100 sessions. The complete schedule is included in
						JSON exports.
					</p>
				)}
				{schedule.unscheduled.length > 0 && (
					<details className="unscheduled-details" open>
						<summary>Work that still needs a place</summary>
						<ul>
							{schedule.unscheduled.slice(0, 100).map((t) => (
								<li key={t.taskId}>
									<strong>{t.title}</strong>
									<span>
										{t.remainingMinutes} minutes unplaced ·{" "}
										{schedule.inputRevision ===
										inputRevision(recoveryDraft ?? workspace, settings)
											? (() => {
													const explanation = unplacedExplanation(
														recoveryDraft ?? workspace,
														settings,
														schedule,
														t,
													);
													return (
														<>
															{explanation.kind === "proven"
																? "No placement under this constraint: "
																: "Heuristic result: "}
															{explanation.reason} <strong>Try:</strong>{" "}
															{explanation.adjustment}
														</>
													);
												})()
											: "Historical result; review a new proposal against current inputs."}
									</span>
								</li>
							))}
						</ul>
					</details>
				)}
			</div>
		);
	}
	return (
		<section
			id="schedule"
			className="scheduling-panel"
			aria-labelledby="schedule-title"
		>
			<div className="section-heading">
				<div>
					<div className="eyebrow">MAKE SPACE FOR THE WORK</div>
					<h2 id="schedule-title">A schedule that fits your life</h2>
					<p>
						One shared calendar across your goals. All times shown in{" "}
						{settings.timezone}.
					</p>
				</div>
			</div>
			<p className="schedule-explainer">
				Set actual work windows, then review a proposal. Goal weekly hours act
				as per-goal caps within shared availability. Sessions can split tasks;
				dependencies must finish first. This heuristic does not prove that an
				alternative arrangement is impossible.
			</p>
			<details
				className="availability-editor"
				open={!workspace.planning?.settings.windows.length}
			>
				<summary>Availability & planning preferences</summary>
				<form
					className="editor-form"
					onSubmit={(e) => {
						e.preventDefault();
						saveSettings();
					}}
				>
					<div className="form-columns">
						<label>
							Planning timezone
							<input
								required
								maxLength={100}
								value={settings.timezone}
								onChange={(e) =>
									update({ ...settings, timezone: e.target.value })
								}
								placeholder="America/Chicago"
							/>
						</label>
						<label>
							Planning horizon (days)
							<input
								type="number"
								min={1}
								max={56}
								required
								value={settings.horizonDays}
								onChange={(e) =>
									update({ ...settings, horizonDays: Number(e.target.value) })
								}
							/>
						</label>
					</div>
					<div className="form-columns">
						<label>
							Maximum session (minutes)
							<input
								type="number"
								min={15}
								max={120}
								required
								value={settings.sessionMinutes}
								onChange={(e) =>
									update({
										...settings,
										sessionMinutes: Number(e.target.value),
									})
								}
							/>
						</label>
						<label>
							Break between sessions (minutes)
							<input
								type="number"
								min={0}
								max={60}
								required
								value={settings.breakMinutes}
								onChange={(e) =>
									update({ ...settings, breakMinutes: Number(e.target.value) })
								}
							/>
						</label>
					</div>
					<h3>Recurring work windows</h3>
					<p className="field-help">
						Use same-day windows. Nonexistent daylight-saving times are skipped
						with a warning; repeated wall times use the earlier occurrence.
					</p>
					{settings.windows.map((w, i) => (
						<fieldset className="availability-row" key={w.id}>
							<legend>Window {i + 1}</legend>
							<label>
								Weekday
								<select
									value={w.weekday}
									onChange={(e) =>
										update({
											...settings,
											windows: settings.windows.map((x) =>
												x.id === w.id
													? { ...x, weekday: Number(e.target.value) }
													: x,
											),
										})
									}
								>
									{weekdays.map((day, i) => (
										<option value={i} key={day}>
											{day}
										</option>
									))}
								</select>
							</label>
							<label>
								Start
								<input
									type="time"
									required
									value={w.start}
									onInput={(e) =>
										update({
											...settings,
											windows: settings.windows.map((x) =>
												x.id === w.id
													? { ...x, start: e.currentTarget.value }
													: x,
											),
										})
									}
								/>
							</label>
							<label>
								End
								<input
									type="time"
									required
									value={w.end}
									onInput={(e) =>
										update({
											...settings,
											windows: settings.windows.map((x) =>
												x.id === w.id
													? { ...x, end: e.currentTarget.value }
													: x,
											),
										})
									}
								/>
							</label>
							<button
								type="button"
								className="quiet-button"
								aria-label={`Remove window ${i + 1}`}
								onClick={() =>
									update({
										...settings,
										windows: settings.windows.filter((x) => x.id !== w.id),
									})
								}
							>
								Remove
							</button>
						</fieldset>
					))}
					<button
						className="quiet-button"
						type="button"
						disabled={settings.windows.length >= 28}
						onClick={() =>
							update({
								...settings,
								windows: [
									...settings.windows,
									{ id: newId(), weekday: 1, start: "18:00", end: "20:00" },
								],
							})
						}
					>
						Add work window
					</button>
					<h3>Fixed commitments</h3>
					<p className="field-help">
						Time you cannot work, such as a class or appointment. Overlapping
						commitments are combined when free time is calculated.
					</p>
					{settings.commitments.map((c, i) => (
						<fieldset className="commitment-row" key={c.id}>
							<legend>Commitment {i + 1}</legend>
							<label>
								Title
								<input
									required
									maxLength={160}
									value={c.title}
									onChange={(e) =>
										update({
											...settings,
											commitments: settings.commitments.map((x) =>
												x.id === c.id ? { ...x, title: e.target.value } : x,
											),
										})
									}
								/>
							</label>
							<label>
								Date
								<input
									type="date"
									required
									value={c.date}
									onInput={(e) =>
										update({
											...settings,
											commitments: settings.commitments.map((x) =>
												x.id === c.id
													? { ...x, date: e.currentTarget.value }
													: x,
											),
										})
									}
								/>
							</label>
							<label>
								Start
								<input
									type="time"
									required
									value={c.start}
									onInput={(e) =>
										update({
											...settings,
											commitments: settings.commitments.map((x) =>
												x.id === c.id
													? { ...x, start: e.currentTarget.value }
													: x,
											),
										})
									}
								/>
							</label>
							<label>
								End
								<input
									type="time"
									required
									value={c.end}
									onInput={(e) =>
										update({
											...settings,
											commitments: settings.commitments.map((x) =>
												x.id === c.id
													? { ...x, end: e.currentTarget.value }
													: x,
											),
										})
									}
								/>
							</label>
							<button
								className="quiet-button"
								type="button"
								onClick={() =>
									update({
										...settings,
										commitments: settings.commitments.filter(
											(x) => x.id !== c.id,
										),
									})
								}
							>
								Remove commitment {i + 1}
							</button>
						</fieldset>
					))}
					<button
						type="button"
						className="quiet-button"
						disabled={settings.commitments.length >= 100}
						onClick={() =>
							update({
								...settings,
								commitments: [
									...settings.commitments,
									{
										id: newId(),
										date: localDate(),
										title: "Fixed commitment",
										start: "18:00",
										end: "19:00",
									},
								],
							})
						}
					>
						Add commitment
					</button>
					<button className="primary-button" type="submit">
						Save availability
					</button>
				</form>
			</details>
			{error && (
				<p className="storage-alert" role="alert">
					{error}
				</p>
			)}
			<p className="field-help" role="status">
				{message}
			</p>
			{computing && (
				<p role="status">
					Scheduling in the background…{" "}
					<button
						className="quiet-button"
						onClick={() => computation.current?.abort()}
					>
						Cancel calculation
					</button>
				</p>
			)}
			<p className="field-help">
				The scheduler chooses eligible tasks by earliest goal deadline, higher
				priority, then board order. It uses chronological free slots; recovery
				can reserve prior allocations. It does not search every ordering.
			</p>
			<div className="schedule-actions">
				<button
					className="primary-button"
					disabled={computing || recovering}
					onClick={generate}
				>
					{accepted ? "Propose replan from now" : "Generate schedule proposal"}
				</button>
				<button
					className="quiet-button"
					onClick={exportCalendar}
					disabled={!accepted || stale || dirty}
				>
					Download calendar (.ics)
				</button>
			</div>
			<RecoveryPanel
				disabled={computing}
				onBusyChange={setRecovering}
				onInvalidate={() => {
					setProposal(null);
					setRecoveryDraft(null);
				}}
				workspace={workspace}
				settings={settings}
				onProposal={(next, schedule) => {
					recoveryBase.current = workspace;
					setRecoveryDraft(next);
					setProposal(schedule);
					setError("");
					setMessage(
						"Recovery proposal only. Review changes before accepting. Protected task sessions are fixed for this proposal.",
					);
				}}
			/>
			{undo && (
				<button
					className="quiet-button"
					disabled={workspace !== undo.after}
					onClick={() => {
						if (workspace !== undo.after) return;
						if (save(undo.before, "Previous board and schedule restored.")) {
							setUndo(null);
							setProposal(null);
							setRecoveryDraft(null);
							setMessage(
								"Recovery undone. Previous goals, availability and schedule restored.",
							);
						}
					}}
				>
					Undo last accepted change (this session)
				</button>
			)}
			{undo && workspace !== undo.after && (
				<p className="field-help">
					Undo is unavailable after further board edits, to avoid overwriting
					newer work.
				</p>
			)}
			{stale && (
				<p className="schedule-warning">
					Your goals or availability have changed since acceptance. Existing
					sessions are kept for reference. Generate and review a replan before
					exporting.
				</p>
			)}
			{proposal && (
				<section className="proposal-review" aria-label="Schedule proposal">
					<h3>Review before committing</h3>
					<p>
						{summary?.retained} allocations retained · {summary?.changedTasks}{" "}
						tasks with moved or resized allocations · {summary?.removed}{" "}
						allocations removed · {summary?.added} new allocations. Unplaced
						effort: {summary?.beforeUnplaced} → {summary?.afterUnplaced}{" "}
						minutes.{" "}
						{recoveryDraft
							? "Protected work stays fixed. Other sessions are retained where feasible. Review every change before accepting."
							: "This creates a fresh allocation from now. Use My week changed to preserve commitments."}{" "}
						Missed work is never automatically completed.
					</p>
					{recoveryDraft && (
						<div className="schedule-warning">
							<strong>Goal changes applied only on acceptance</strong>
							<ul>
								{recoveryDraft.goals.map((g) => {
									const old = workspace.goals.find((x) => x.id === g.id);
									if (!old) return null;
									return (
										<li key={g.id}>
											{g.title}: weekly hours {old.weeklyHours} →{" "}
											{g.weeklyHours}; target {old.targetDate} → {g.targetDate}
										</li>
									);
								})}
							</ul>
							<ul>
								{recoveryDraft.goals
									.flatMap((g) => g.milestones.flatMap((m) => m.tasks))
									.flatMap((t) => {
										const old = workspace.goals
											.flatMap((g) => g.milestones.flatMap((m) => m.tasks))
											.find((x) => x.id === t.id);
										return old && old.minutes !== t.minutes
											? [
													<li key={t.id}>
														{t.title}: {old.minutes} → {t.minutes} minutes
													</li>,
												]
											: [];
									})}
							</ul>
							<p>
								Task estimates and unsaved availability included in this
								recovery will also be applied. Discarding keeps the accepted
								board unchanged.
							</p>
						</div>
					)}
					{proposal.unscheduled.length > 0 && (
						<p className="schedule-warning">
							Some work still needs a place. Review the reasons below, then
							reduce scope, add work windows, raise a goal’s weekly budget, or
							extend its deadline. This heuristic does not prove that every
							alternative is impossible.
						</p>
					)}
					{renderSchedule(proposal, recoveryDraft ?? workspace)}
					<details>
						<summary>Compare with accepted version</summary>
						<ul className="change-list">
							{changes.map((c) => (
								<li key={c.taskId}>
									<strong>{c.title}</strong>
									<span>
										{c.before.length} previous → {c.after.length} proposed
										sessions
									</span>
									{c.before[0] && <small>Was: {c.before[0].start}</small>}
									{c.after[0] && <small>Proposed: {c.after[0].start}</small>}
								</li>
							))}
						</ul>
					</details>
					<div className="schedule-actions">
						<button className="primary-button" onClick={accept}>
							Accept this schedule
						</button>
						<button
							className="quiet-button"
							onClick={() => {
								setProposal(null);
								setRecoveryDraft(null);
								setMessage("Proposal discarded. Accepted schedule unchanged.");
							}}
						>
							Discard proposal
						</button>
					</div>
				</section>
			)}
			{accepted && (
				<details className="accepted-schedule" open={!proposal}>
					<summary>
						Accepted schedule ·{" "}
						{new Date(accepted.createdAt).toLocaleDateString()}
					</summary>
					{renderSchedule(accepted)}
				</details>
			)}
			<details className="scenario-panel">
				<summary>What if things change?</summary>
				<p>
					Compare a hypothetical plan without changing your goals or accepted
					sessions.
				</p>
				<label>
					Scenario
					<select
						value={scenarioKind}
						onChange={(e) => {
							computation.current?.abort();
							setScenarioKind(e.target.value);
							setScenario(null);
						}}
					>
						<option value="half">
							Halve each goal’s weekly budget (minimum 30 minutes)
						</option>
						<option value="later">
							Move every goal deadline seven days later
						</option>
					</select>
				</label>
				<button
					className="quiet-button"
					disabled={computing || recovering}
					onClick={compare}
				>
					Compare scenario
				</button>
				{scenario && (
					<section aria-label="Scenario result">
						{renderSchedule(scenario)}
					</section>
				)}
			</details>
			{!!workspace.planning?.history.length && (
				<details className="schedule-history">
					<summary>
						Accepted version history ({workspace.planning.history.length}/10
						retained)
					</summary>
					{workspace.planning.history.map((s) => (
						<details key={s.id}>
							<summary>
								{new Date(s.createdAt).toLocaleString()} · {s.sessions.length}{" "}
								sessions
							</summary>
							{renderSchedule(s)}
						</details>
					))}
				</details>
			)}
		</section>
	);
}
