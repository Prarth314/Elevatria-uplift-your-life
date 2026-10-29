import { useEffect, useState } from "react";
import type { Workspace } from "./model.ts";
import { newId, localDate } from "./model.ts";
import { defaultSettings } from "./schedule-types.ts";
import type { Schedule, ScheduleSettings } from "./schedule-types.ts";
import {
	generateSchedule,
	inputRevision,
	scheduleDiff,
	scheduleViolations,
} from "./scheduler.ts";
import { settingsErrors } from "./schedule-validation.ts";
import { validTimezone } from "./time.ts";
import { addDays } from "./time.ts";
import { calendarFile, downloadFile } from "./portability.ts";
const weekdays = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const reasons = {
	DEPENDENCY_BLOCKED: "A prerequisite could not be fully scheduled.",
	INSUFFICIENT_CAPACITY:
		"Could not fit within availability, weekly goal budgets, session sizes, and deadlines in this horizon.",
	DEADLINE_PASSED: "The target date has already passed.",
};
export function SchedulePanel({
	workspace,
	save,
}: {
	workspace: Workspace;
	save: (workspace: Workspace, message?: string) => void;
}) {
	const [settings, setSettings] = useState<ScheduleSettings>(
		() => workspace.planning?.settings ?? defaultSettings(),
	);
	const [proposal, setProposal] = useState<Schedule | null>(null);
	const [scenario, setScenario] = useState<Schedule | null>(null);
	const [scenarioKind, setScenarioKind] = useState("half");
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	useEffect(() => {
		setSettings(workspace.planning?.settings ?? defaultSettings());
		setProposal(null);
		setScenario(null);
	}, [workspace.planning?.settings]);
	const accepted = workspace.planning?.accepted;
	const revision = inputRevision(workspace, settings);
	const stale = !!accepted && accepted.inputRevision !== revision;
	const dirty =
		JSON.stringify(settings) !==
		JSON.stringify(workspace.planning?.settings ?? defaultSettings());
	const changes = proposal ? scheduleDiff(accepted, proposal) : [];
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
		save(
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
		setError("");
		setMessage(
			"Availability saved. Existing accepted sessions remain unchanged.",
		);
	}
	function generate() {
		try {
			if (dirty) throw Error("Save availability before generating a proposal.");
			setProposal(generateSchedule(workspace, settings));
			setError("");
			setMessage("Proposal generated. Your accepted schedule has not changed.");
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Scheduling failed. Try again.",
			);
		}
	}
	function accept() {
		if (!proposal) return;
		try {
			if (
				dirty ||
				proposal.inputRevision !== inputRevision(workspace, settings)
			)
				throw Error(
					"This proposal is stale. Generate again using the latest goals and availability.",
				);
			if (proposal.sessions.some((s) => Date.parse(s.start) < Date.now()))
				throw Error(
					"A proposed session is already in the past. Generate a fresh proposal.",
				);
			const errors = scheduleViolations(workspace, settings, proposal);
			if (errors.length) throw Error(errors.join(" "));
			save(
				{
					...workspace,
					planning: {
						settings,
						accepted: proposal,
						history: [
							...(accepted ? [accepted] : []),
							...(workspace.planning?.history ?? []),
						].slice(0, 10),
					},
				},
				"Schedule accepted. Previous accepted versions remain in history.",
			);
			setProposal(null);
			setError("");
			setMessage("Schedule accepted and saved on this device.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not accept schedule.");
		}
	}
	function compare() {
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
			setScenario(generateSchedule(variant, settings));
			setError("");
			setMessage(
				"Scenario only. Goals, dates, and accepted sessions remain unchanged.",
			);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Scenario could not be computed.",
			);
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
				calendarFile(accepted),
				`elevatria-${localDate()}.ics`,
				"text/calendar;charset=utf-8",
			);
			setError("");
			setMessage(
				"Calendar downloaded. Import behavior, including updates, depends on your calendar application.",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Calendar export failed.");
		}
	}
	function renderSchedule(schedule: Schedule) {
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
					hours placed · {schedule.unscheduled.length} tasks with unscheduled
					work
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
							<strong>{s.title}</strong>
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
										{t.remainingMinutes} minutes remaining · {reasons[t.reason]}
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
			<div className="schedule-actions">
				<button className="primary-button" onClick={generate}>
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
						{changes.length} tasks have a different allocation. This recomputes
						unfinished work from now; it does not automatically mark missed work
						complete or preserve manually locked sessions.
					</p>
					{renderSchedule(proposal)}
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
				<button className="quiet-button" onClick={compare}>
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
