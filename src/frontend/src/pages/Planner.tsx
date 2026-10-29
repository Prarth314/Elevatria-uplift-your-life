import { useEffect, useState } from "react";
import {
	ArrowDown,
	ArrowUpRight,
	Check,
	ChevronRight,
	Download,
	Flower2,
	LayoutGrid,
	Leaf,
	ListChecks,
	Pencil,
	Plus,
	Sprout,
	Target,
	Trash2,
} from "lucide-react";
import {
	GoalEditor,
	ItemEditor,
	TaskEditor,
	TitleEditor,
	ConfirmEditor,
} from "../planner/Editors";
import { localDate, newId, progress, validWorkspace } from "../planner/model";
import type { Goal, Task, Workspace, VisionItem } from "../planner/model";
import {
	loadWorkspace,
	saveWorkspace,
	WORKSPACE_KEY,
} from "../planner/persistence";
import { capacity, generatePlan, weeklyFocus } from "../planner/planning";
import { sampleWorkspace } from "../planner/sample";
import "../planner/planner.css";

type Editing =
	| { kind: "goal"; goal?: Goal }
	| { kind: "item"; item?: VisionItem }
	| { kind: "task"; milestoneId: string; task?: Task }
	| { kind: "milestone"; id?: string; title: string }
	| {
			kind: "confirm";
			title: string;
			description: string;
			action: string;
			confirm: () => void;
	  }
	| null;
const formatDate = (date: string) =>
	new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`;
// Defer accessing the browser's storage getter until the persistence try/catch.
const browserStorage = {
	getItem: (key: string) => window.localStorage.getItem(key),
	setItem: (key: string, value: string) =>
		window.localStorage.setItem(key, value),
};
export default function Planner() {
	const [initial] = useState(() => {
		try {
			return loadWorkspace(browserStorage);
		} catch {
			return {
				status: "error" as const,
				message:
					"Browser storage is unavailable. You can explore, but export your work before leaving.",
			};
		}
	});
	const [workspace, setWorkspace] = useState<Workspace>(() =>
		initial.status === "ready" ? initial.workspace : sampleWorkspace(),
	);
	const [selectedId, setSelectedId] = useState(
		() => workspace.goals[0]?.id ?? "",
	);
	const [editing, setEditing] = useState<Editing>(null);
	const [saveError, setSaveError] = useState(
		initial.status === "error" ? initial.message : "",
	);
	const [blocked, setBlocked] = useState(initial.status === "error");
	const [notice, setNotice] = useState("");
	const [view, setView] = useState<"plan" | "focus">("plan");
	const goal =
		workspace.goals.find((g) => g.id === selectedId) ?? workspace.goals[0];
	const stats = goal ? progress(goal) : null;
	const estimate = goal ? capacity(goal, localDate()) : null;
	const close = () => setEditing(null);

	function persist(next: Workspace, message = "Changes saved on this device.") {
		if (!validWorkspace(next)) {
			setSaveError(
				"This change exceeds a board limit or contains invalid data. Your previous board is unchanged.",
			);
			return;
		}
		setWorkspace(next);
		if (blocked) {
			setNotice("Changes are in memory only. Export your board to keep them.");
			return;
		}
		const error = saveWorkspace(browserStorage, next);
		setSaveError(error ?? "");
		setNotice(error ? "Changes are in memory only." : message);
	}
	useEffect(() => {
		// Remove the old prototype's browser-stored provider key without reading it.
		try {
			localStorage.removeItem("elevatria_openai_key");
		} catch {
			/* Storage status is shown separately. */
		}
		if (initial.status === "empty")
			setSaveError(saveWorkspace(browserStorage, workspace) ?? "");
		function externalChange(event: StorageEvent) {
			if (event.key === WORKSPACE_KEY || event.key === null) {
				setBlocked(true);
				setSaveError(
					"This board changed in another tab. Export any unsaved work, then reload to use the latest saved board.",
				);
			}
		}
		window.addEventListener("storage", externalChange);
		return () => window.removeEventListener("storage", externalChange);
		// This effect initializes storage once. Later writes go through persist().
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	function updateGoal(next: Goal, message?: string) {
		persist(
			{
				...workspace,
				goals: workspace.goals.map((g) => (g.id === next.id ? next : g)),
			},
			message,
		);
	}
	function saveGoal(next: Goal) {
		const exists = workspace.goals.some((g) => g.id === next.id);
		persist({
			...workspace,
			goals: exists
				? workspace.goals.map((g) => (g.id === next.id ? next : g))
				: [...workspace.goals, next],
		});
		setSelectedId(next.id);
		close();
	}
	function saveItem(next: VisionItem) {
		persist({
			...workspace,
			items: workspace.items.some((i) => i.id === next.id)
				? workspace.items.map((i) => (i.id === next.id ? next : i))
				: [...workspace.items, next],
		});
		close();
	}
	function confirm(
		title: string,
		description: string,
		action: string,
		perform: () => void,
	) {
		setEditing({
			kind: "confirm",
			title,
			description,
			action,
			confirm: () => {
				perform();
				close();
			},
		});
	}
	function removeGoal() {
		if (!goal) return;
		confirm(
			"Remove this goal?",
			"Its plan and progress will be removed. Connected inspiration will stay on your board.",
			"Remove goal",
			() => {
				persist({
					...workspace,
					goals: workspace.goals.filter((g) => g.id !== goal.id),
					items: workspace.items.map((i) =>
						i.goalId === goal.id ? { ...i, goalId: "" } : i,
					),
				});
				setSelectedId("");
			},
		);
	}
	function toggleTask(milestoneId: string, task: Task) {
		if (!goal) return;
		updateGoal(
			{
				...goal,
				milestones: goal.milestones.map((m) =>
					m.id === milestoneId
						? {
								...m,
								tasks: m.tasks.map((t) =>
									t.id === task.id ? { ...t, completed: !t.completed } : t,
								),
							}
						: m,
				),
			},
			task.completed ? "Task reopened." : "One step closer. Task completed.",
		);
	}
	function regenerate() {
		if (!goal) return;
		const run = () => {
			updateGoal(
				{ ...goal, milestones: generatePlan(goal) },
				"Local starter plan created. Edit it to match your goal.",
			);
			setView("plan");
		};
		if (goal.milestones.length)
			confirm(
				"Create a fresh starter plan?",
				"This replaces the current milestones, tasks, and completion history for this goal. Cancel to keep your work.",
				"Replace plan",
				run,
			);
		else run();
	}
	function reset(empty: boolean) {
		confirm(
			empty ? "Start a fresh board?" : "Reload the sample project?",
			"This replaces this device’s board. Export a backup first if you want to keep your work.",
			empty ? "Start fresh" : "Load sample",
			() => {
				const next: Workspace = empty
					? { version: 1, goals: [], items: [] }
					: sampleWorkspace();
				setBlocked(false);
				setWorkspace(next);
				setSelectedId(next.goals[0]?.id ?? "");
				const error = saveWorkspace(browserStorage, next);
				setSaveError(error ?? "");
				setNotice(
					error ? "Board is in memory only." : "Board saved on this device.",
				);
			},
		);
	}
	function exportBoard() {
		downloadBoard(JSON.stringify(workspace, null, 2));
	}
	function exportSavedBackup() {
		let raw = JSON.stringify(workspace, null, 2);
		if (blocked) {
			try {
				raw = localStorage.getItem(WORKSPACE_KEY) ?? raw;
			} catch {
				/* Export the in-memory board if storage cannot be read. */
			}
		}
		downloadBoard(raw);
	}
	function downloadBoard(raw: string) {
		const url = URL.createObjectURL(
			new Blob([raw], { type: "application/json" }),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = `elevatria-board-${localDate()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}
	function taskRow(task: Task, milestoneId: string) {
		return (
			<div
				className={`task-row ${task.completed ? "task-completed" : ""}`}
				key={task.id}
			>
				<input
					type="checkbox"
					aria-label={`Complete: ${task.title}`}
					checked={task.completed}
					onChange={() => toggleTask(milestoneId, task)}
				/>
				<button
					className="task-title"
					onClick={() => setEditing({ kind: "task", milestoneId, task })}
				>
					{task.title}
					<span className="sr-only"> — edit task</span>
				</button>
				<span className="task-duration">{task.minutes}m</span>
				<button
					className="icon-button task-delete"
					aria-label={`Remove task: ${task.title}`}
					onClick={() =>
						confirm(
							"Remove this task?",
							"This removes the task and its completion record.",
							"Remove task",
							() =>
								updateGoal({
									...goal!,
									milestones: goal!.milestones.map((m) =>
										m.id === milestoneId
											? { ...m, tasks: m.tasks.filter((t) => t.id !== task.id) }
											: m,
									),
								}),
						)
					}
				>
					<Trash2 size={14} />
				</button>
			</div>
		);
	}

	return (
		<div className="planner-app">
			<a className="skip-link" href="#board">
				Skip to vision board
			</a>
			<aside className="planner-sidebar">
				<a
					className="planner-brand"
					href="#board"
					aria-label="Elevatria — Uplift Your Life"
				>
					<span className="brand-symbol">
						<Sprout size={26} />
					</span>
					<span>
						elevatria<span className="brand-tagline">UPLIFT YOUR LIFE</span>
					</span>
				</a>
				<div className="sidebar-section">YOUR SPACE</div>
				<nav aria-label="Workspace">
					<a className="nav-active" href="#board">
						<LayoutGrid size={18} />
						Vision board
						<span className="nav-count">{workspace.goals.length}</span>
					</a>
					<a href="#plan" onClick={() => setView("plan")}>
						<ListChecks size={18} />
						My action plan
					</a>
					<a href="#progress">
						<Target size={18} />
						Progress
					</a>
				</nav>
				<div className="sidebar-note">
					<Flower2 size={30} strokeWidth={1} />
					<p>
						Big dreams.
						<br />
						<em>Small, steady steps.</em>
					</p>
					<span>
						You don’t need to see the whole staircase to take the first step.
					</span>
				</div>
				<div className="sidebar-bottom">
					<span className="demo-dot" />
					LOCAL DEMO
					<button onClick={exportBoard}>
						<Download size={15} />
						Export board
					</button>
					<button onClick={() => reset(false)}>
						Explore sample project <ArrowUpRight size={14} />
					</button>
					<button onClick={() => reset(true)}>Start a fresh board</button>
					<small>Saved in this browser. No account or cloud sync.</small>
				</div>
			</aside>
			<div className="planner-main">
				<header className="planner-topbar">
					<span>
						Local demo · Your space to grow <Leaf size={13} />
					</span>
					<span className="save-status" role="status">
						<span
							className={saveError || blocked ? "status-warn" : "status-dot"}
						/>
						{saveError || blocked
							? "Saved changes need attention"
							: "Saved on this device"}
					</span>
				</header>
				<main>
					{saveError && (
						<div className="storage-alert" role="alert">
							<p>{saveError}</p>
							<div>
								{!blocked && (
									<button
										onClick={() => {
											const error = saveWorkspace(browserStorage, workspace);
											setSaveError(error ?? "");
										}}
									>
										Retry saving
									</button>
								)}
								<button onClick={exportBoard}>Export working board</button>
								{blocked && (
									<button onClick={exportSavedBackup}>
										Export saved backup
									</button>
								)}
								{blocked && (
									<button onClick={() => window.location.reload()}>
										Reload saved board
									</button>
								)}
							</div>
						</div>
					)}
					<section className="planner-heading" aria-labelledby="page-title">
						<div>
							<div className="eyebrow">
								A LITTLE INTENTION. A LOT OF POSSIBILITY.
							</div>
							<h1 id="page-title">
								Make room for <em>what’s next.</em>
							</h1>
							<p>Gather your vision. Give it a plan. Grow at your own pace.</p>
						</div>
						<button
							className="primary-button"
							onClick={() => setEditing({ kind: "goal" })}
						>
							<Plus size={18} />
							New goal
						</button>
					</section>
					<section
						id="board"
						className="board-section"
						aria-labelledby="board-title"
					>
						<div className="section-heading">
							<div>
								<h2 id="board-title">
									The vision board <span className="small-flower">✳</span>
								</h2>
								<p>A place for the future you’re building.</p>
							</div>
							<button
								className="quiet-button"
								onClick={() => setEditing({ kind: "item" })}
							>
								<Plus size={16} />
								Add inspiration
							</button>
						</div>
						<div className="vision-grid">
							{workspace.goals.map((g, i) => {
								const p = progress(g);
								return (
									<article
										className={`goal-card ${g.color} ${goal?.id === g.id ? "selected-card" : ""}`}
										key={g.id}
									>
										<button
											className="goal-card-select"
											aria-pressed={goal?.id === g.id}
											onClick={() => {
												setSelectedId(g.id);
												setView("plan");
											}}
										>
											<span className="card-topline">
												<span>
													<Target size={13} />
													GOAL {String(i + 1).padStart(2, "0")}
												</span>
												<ArrowUpRight size={18} />
											</span>
											<div className="goal-art" aria-hidden="true">
												<span className="art-sun" />
												<span className="art-hill hill-one" />
												<span className="art-hill hill-two" />
												<span className="art-path" />
											</div>
											<div className="goal-card-content">
												<span className="card-category">
													CREATE · LEARN · BECOME
												</span>
												<h3>{g.title}</h3>
												<div className="card-footer">
													<span>{formatDate(g.targetDate)}</span>
													<span>{p.percent}% complete</span>
												</div>
												<div className="card-progress">
													<span style={{ width: `${p.percent}%` }} />
												</div>
											</div>
										</button>
										<button
											className="card-edit"
											aria-label={`Edit goal: ${g.title}`}
											onClick={() => setEditing({ kind: "goal", goal: g })}
										>
											<Pencil size={14} />
										</button>
									</article>
								);
							})}
							{workspace.items.map((item, i) => (
								<article
									className={`inspiration-card ${i % 2 ? "paper-card" : "botanical-card"}`}
									key={item.id}
								>
									<button
										className="inspiration-edit"
										onClick={() => setEditing({ kind: "item", item })}
										aria-label={`Edit inspiration: ${item.title}`}
									>
										{item.image ? (
											<img src={item.image} alt={item.content || item.title} />
										) : (
											<div
												className="inspiration-decoration"
												aria-hidden="true"
											>
												{i % 2 ? (
													<span>“</span>
												) : (
													<Flower2 size={86} strokeWidth={0.65} />
												)}
											</div>
										)}
										<div className="inspiration-content">
											<span className="card-category">
												{i % 2
													? "A NOTE TO MY FUTURE SELF"
													: "THE FEELING I’M WORKING TOWARD"}
											</span>
											<h3>{item.title}</h3>
											<p>{item.content}</p>
											{item.goalId && (
												<span className="linked-goal">
													<span />
													Connected to a goal
												</span>
											)}
										</div>
										<Pencil className="inspiration-pencil" size={14} />
									</button>
									<button
										className="pin-remove"
										aria-label={`Remove inspiration: ${item.title}`}
										onClick={() =>
											confirm(
												"Remove this inspiration?",
												"This removes the image and note from this device’s board.",
												"Remove inspiration",
												() =>
													persist({
														...workspace,
														items: workspace.items.filter(
															(i) => i.id !== item.id,
														),
													}),
											)
										}
									>
										<Trash2 size={14} />
									</button>
								</article>
							))}
							{workspace.goals.length === 0 && (
								<button
									className="empty-goal-card"
									onClick={() => setEditing({ kind: "goal" })}
								>
									<span>
										<Plus size={24} />
									</span>
									<h3>
										Every next chapter
										<br />
										starts with a vision.
									</h3>
									<p>Add your first goal</p>
								</button>
							)}
						</div>
						<div className="board-caption">
							<span>
								<Sprout size={14} />
								Your vision is allowed to evolve.
							</span>
							<a href="#plan">
								Turn intention into action <ArrowDown size={14} />
							</a>
						</div>
					</section>
					{goal && stats && estimate ? (
						<div className="action-layout">
							<section
								id="plan"
								className="action-panel"
								aria-labelledby="plan-title"
							>
								<div className="section-heading">
									<div>
										<div className="eyebrow">FROM VISION TO ACTION</div>
										<h2 id="plan-title">Your next chapter</h2>
									</div>
									<button
										className="icon-button"
										aria-label="Edit selected goal"
										onClick={() => setEditing({ kind: "goal", goal })}
									>
										<Pencil size={17} />
									</button>
								</div>
								<div className="selected-goal-header">
									<span className={`goal-color ${goal.color}`} />
									<h3>{goal.title}</h3>
								</div>
								<p className="goal-description">
									{goal.description ||
										"Add a description to define what success means for this goal."}
								</p>
								<div className="plan-toolbar">
									<div
										className="view-switch"
										role="group"
										aria-label="Plan view"
									>
										<button
											aria-pressed={view === "plan"}
											onClick={() => setView("plan")}
										>
											Milestones
										</button>
										<button
											aria-pressed={view === "focus"}
											onClick={() => setView("focus")}
										>
											Weekly focus
										</button>
									</div>
									<button className="text-button" onClick={regenerate}>
										<Sprout size={14} />
										{goal.milestones.length
											? "New starter plan"
											: "Generate starter plan"}
									</button>
								</div>
								{view === "plan" ? (
									<div className="milestone-list">
										{goal.milestones.map((m, i) => (
											<section
												className="milestone"
												key={m.id}
												aria-label={`Milestone ${i + 1}: ${m.title}`}
											>
												<div className="milestone-heading">
													<span
														className={`milestone-number ${m.tasks.length && m.tasks.every((t) => t.completed) ? "milestone-done" : ""}`}
													>
														{m.tasks.length &&
														m.tasks.every((t) => t.completed) ? (
															<Check size={15} />
														) : (
															String(i + 1).padStart(2, "0")
														)}
													</span>
													<button
														className="milestone-title"
														onClick={() =>
															setEditing({
																kind: "milestone",
																id: m.id,
																title: m.title,
															})
														}
													>
														{m.title}
														<Pencil size={12} />
													</button>
													<span className="milestone-count">
														{m.tasks.filter((t) => t.completed).length}/
														{m.tasks.length}
													</span>
													<button
														className="icon-button"
														aria-label={`Remove milestone: ${m.title}`}
														onClick={() =>
															confirm(
																"Remove this milestone?",
																"This also removes all of its tasks and progress.",
																"Remove milestone",
																() =>
																	updateGoal({
																		...goal,
																		milestones: goal.milestones.filter(
																			(x) => x.id !== m.id,
																		),
																	}),
															)
														}
													>
														<Trash2 size={13} />
													</button>
												</div>
												<div className="milestone-tasks">
													{m.tasks.map((t) => taskRow(t, m.id))}
													<button
														className="add-task"
														onClick={() =>
															setEditing({ kind: "task", milestoneId: m.id })
														}
													>
														<Plus size={13} />
														Add task
													</button>
												</div>
											</section>
										))}
										{goal.milestones.length === 0 && (
											<div className="empty-plan">
												<Sprout size={35} />
												<h3>Let’s find the first step.</h3>
												<p>
													Generate a local starter plan, then tailor its
													milestones and tasks to your vision.
												</p>
												<button className="primary-button" onClick={regenerate}>
													Generate starter plan <ChevronRight size={15} />
												</button>
											</div>
										)}
										<button
											className="add-milestone"
											onClick={() =>
												setEditing({ kind: "milestone", title: "" })
											}
										>
											<Plus size={15} />
											Add milestone
										</button>
									</div>
								) : (
									<div className="weekly-focus">
										<h3>A manageable starting point</h3>
										<p>
											Next tasks in plan order, up to your {goal.weeklyHours}h
											weekly budget. This is a focus list, not a scheduled
											calendar. Choose your work sessions yourself.
										</p>
										{weeklyFocus(goal).map((t) =>
											taskRow(
												t,
												goal.milestones.find((m) =>
													m.tasks.some((x) => x.id === t.id),
												)!.id,
											),
										)}
										{weeklyFocus(goal).length === 0 && (
											<p className="empty-focus">
												{stats.remaining === 0 && stats.total > 0
													? "All done. Take a moment to celebrate."
													: stats.total === 0
														? "Add tasks or generate a starter plan first."
														: "The next task is larger than your weekly budget. Split it into smaller tasks or increase your available time."}
											</p>
										)}
									</div>
								)}
								<div className="plan-footnote">
									<Leaf size={14} />
									<span>
										Local planning tools · No AI service connected. Starter
										plans use a general template; edit them for your goal.
									</span>
								</div>
							</section>
							<aside className="goal-summary">
								<section id="progress" className="progress-panel">
									<div className="eyebrow">LOOK HOW FAR YOU’VE COME</div>
									<div className="progress-display">
										<span>
											{stats.percent}
											<small>%</small>
										</span>
										<Flower2 size={42} strokeWidth={0.7} />
									</div>
									<h3>
										{stats.total > 0 && stats.done === stats.total
											? "You made it happen."
											: "Progress, one step at a time."}
									</h3>
									<p>
										{stats.done} of {stats.total} tasks complete
									</p>
									<progress
										aria-label="Goal progress by estimated effort"
										max="100"
										value={stats.percent}
									/>
									<small>Progress is weighted by estimated task time.</small>
								</section>
								<section className="goal-details">
									<h3>A plan that fits your life</h3>
									<dl>
										<div>
											<dt>Target date</dt>
											<dd>{formatDate(goal.targetDate)}</dd>
										</div>
										<div>
											<dt>Weekly availability</dt>
											<dd>{goal.weeklyHours} hours</dd>
										</div>
										<div>
											<dt>Remaining effort</dt>
											<dd>{hours(stats.remaining)}</dd>
										</div>
									</dl>
									{goal.constraints && (
										<div className="constraints">
											<span>YOUR BOUNDARIES</span>
											<p>{goal.constraints}</p>
										</div>
									)}
									{stats.total > 0 && (
										<p
											className={`capacity-note ${estimate.over ? "capacity-warning" : ""}`}
										>
											{estimate.over
												? "Your remaining estimate exceeds the time available before your target. Reduce scope, add time, or move the target date."
												: `${estimate.weeks} ${estimate.weeks === 1 ? "week" : "weeks"} of focused effort at your current pace.`}
											<small>
												Rough capacity estimate. Specific days, dependencies,
												and automatic scheduling come next.
											</small>
										</p>
									)}
									<button
										className="quiet-button"
										onClick={() => setEditing({ kind: "goal", goal })}
									>
										Adjust goal details <ArrowUpRight size={14} />
									</button>
									<button className="remove-goal" onClick={removeGoal}>
										Remove goal
									</button>
								</section>
								<div className="coach-note">
									<span>
										<Leaf size={18} />A GENTLE NUDGE
									</span>
									<p>
										{stats.total && stats.done === stats.total
											? "Pause, reflect, and make room for the next chapter."
											: "Make your next task small enough to begin today. Consistency grows from a realistic plan."}
									</p>
								</div>
							</aside>
						</div>
					) : (
						<section id="plan" className="no-goals">
							<h2>Your next chapter starts here.</h2>
							<p>
								Create a goal with a target date and weekly time budget, then
								turn it into an editable plan.
							</p>
							<button
								className="primary-button"
								onClick={() => setEditing({ kind: "goal" })}
							>
								Create your first goal <ArrowUpRight size={16} />
							</button>
						</section>
					)}
					<div className="mobile-board-actions">
						<span>
							Local demo · Saved in this browser. No account or cloud sync.
						</span>
						<div>
							<button onClick={exportBoard}>Export board</button>
							<button onClick={() => reset(false)}>Load sample</button>
							<button onClick={() => reset(true)}>Start fresh</button>
						</div>
					</div>
					<footer className="planner-footer">
						<span>
							elevatria <span>— Uplift Your Life</span>
						</span>
						<span>Built for intention. Made for real life.</span>
					</footer>
				</main>
			</div>
			<div className="sr-only" role="status" aria-live="polite">
				{notice}
			</div>
			{editing?.kind === "goal" && (
				<GoalEditor goal={editing.goal} save={saveGoal} close={close} />
			)}
			{editing?.kind === "item" && (
				<ItemEditor
					item={editing.item}
					goals={workspace.goals}
					save={saveItem}
					close={close}
				/>
			)}
			{editing?.kind === "task" && goal && (
				<TaskEditor
					task={editing.task}
					close={close}
					save={(task) => {
						updateGoal({
							...goal,
							milestones: goal.milestones.map((m) =>
								m.id === editing.milestoneId
									? {
											...m,
											tasks: m.tasks.some((t) => t.id === task.id)
												? m.tasks.map((t) => (t.id === task.id ? task : t))
												: [...m.tasks, task],
										}
									: m,
							),
						});
						close();
					}}
				/>
			)}
			{editing?.kind === "milestone" && goal && (
				<TitleEditor
					title={editing.title}
					close={close}
					save={(title) => {
						updateGoal({
							...goal,
							milestones: editing.id
								? goal.milestones.map((m) =>
										m.id === editing.id ? { ...m, title } : m,
									)
								: [...goal.milestones, { id: newId(), title, tasks: [] }],
						});
						close();
					}}
				/>
			)}
			{editing?.kind === "confirm" && (
				<ConfirmEditor {...editing} close={close} />
			)}
		</div>
	);
}
