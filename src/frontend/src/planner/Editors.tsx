import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { newId, dateAfter, localDate, safeImage } from "./model.ts";
import type { Goal, Task, VisionItem } from "./model.ts";

export function Editor({
	title,
	description,
	close,
	children,
}: {
	title: string;
	description: string;
	close: () => void;
	children: ReactNode;
}) {
	const [opener] = useState(() =>
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null,
	);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) close();
			}}
		>
			<DialogContent
				className="planner-dialog"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					opener?.focus();
				}}
			>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
				{children}
			</DialogContent>
		</Dialog>
	);
}
export function GoalEditor({
	goal,
	save,
	close,
}: { goal?: Goal; save: (goal: Goal) => void; close: () => void }) {
	const [draft, setDraft] = useState<Goal>(
		goal ?? {
			id: newId(),
			title: "",
			description: "",
			targetDate: dateAfter(28),
			weeklyHours: 4,
			constraints: "",
			color: "forest",
			milestones: [],
		},
	);
	const set = <K extends keyof Goal>(key: K, value: Goal[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));
	function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const values = new FormData(e.currentTarget);
		save({
			...draft,
			targetDate: String(values.get("targetDate")),
			weeklyHours: Number(values.get("weeklyHours")),
			title: draft.title.trim(),
			description: draft.description.trim(),
			constraints: draft.constraints.trim(),
		});
	}
	return (
		<Editor
			title={goal ? "Shape your goal" : "Give your vision a destination"}
			description="Start with a clear outcome. You can change the details as you learn."
			close={close}
		>
			<form onSubmit={submit} className="editor-form">
				<label>
					Goal title
					<input
						autoFocus
						required
						pattern={".*\\S.*"}
						maxLength={160}
						value={draft.title}
						onChange={(e) => set("title", e.target.value)}
						placeholder="What do you want to make happen?"
					/>
				</label>
				<label>
					What does success look like?
					<textarea
						maxLength={2000}
						value={draft.description}
						onChange={(e) => set("description", e.target.value)}
						placeholder="Describe a concrete outcome you can work toward."
					/>
				</label>
				<div className="form-columns">
					<label>
						Target date
						<input
							type="date"
							name="targetDate"
							required
							min={goal ? undefined : localDate()}
							value={draft.targetDate}
							onChange={(e) => set("targetDate", e.target.value)}
						/>
					</label>
					<label>
						Available hours per week
						<input
							type="number"
							name="weeklyHours"
							min="0.5"
							max="80"
							step="0.5"
							required
							value={draft.weeklyHours}
							onChange={(e) => set("weeklyHours", Number(e.target.value))}
						/>
					</label>
				</div>
				<label>
					Constraints & boundaries
					<textarea
						maxLength={2000}
						value={draft.constraints}
						onChange={(e) => set("constraints", e.target.value)}
						placeholder="Classes, budget, energy, resources, or anything to keep in mind."
					/>
				</label>
				<label>
					Plan category
					<select
						value={draft.category ?? "custom"}
						onChange={(e) =>
							set("category", e.target.value as Goal["category"])
						}
					>
						<option value="custom">Custom goal</option>
						<option value="project">Software or practical project</option>
						<option value="learning">Learn a skill</option>
						<option value="creative">Creative project</option>
					</select>
				</label>
				<label>
					Scheduling priority
					<select
						value={draft.priority ?? 2}
						onChange={(e) =>
							set("priority", Number(e.target.value) as Goal["priority"])
						}
					>
						<option value="1">Low</option>
						<option value="2">Normal</option>
						<option value="3">High</option>
					</select>
				</label>
				<label>
					Board color
					<select
						value={draft.color}
						onChange={(e) => set("color", e.target.value as Goal["color"])}
					>
						<option value="forest">Forest</option>
						<option value="clay">Terracotta</option>
						<option value="lavender">Lavender</option>
					</select>
				</label>
				<div className="editor-actions">
					<button type="button" className="quiet-button" onClick={close}>
						Cancel
					</button>
					<button className="primary-button" type="submit">
						Save goal
					</button>
				</div>
			</form>
		</Editor>
	);
}
export function ItemEditor({
	item,
	goals,
	save,
	close,
}: {
	item?: VisionItem;
	goals: Goal[];
	save: (item: VisionItem) => void;
	close: () => void;
}) {
	const [draft, setDraft] = useState<VisionItem>(
		item ?? {
			id: newId(),
			title: "",
			content: "",
			image: "",
			goalId: goals[0]?.id ?? "",
		},
	);
	const [error, setError] = useState("");
	const [reading, setReading] = useState(false);
	async function upload(file?: File) {
		if (!file) return;
		setError("");
		if (
			!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
			file.size > 1_000_000
		) {
			setError("Choose a PNG, JPEG, or WebP image under 1 MB.");
			return;
		}
		setReading(true);
		try {
			const image = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
			if (!safeImage(image)) throw new Error("Invalid image");
			setDraft((d) => ({ ...d, image }));
		} catch {
			setError("This image could not be read. Please try another file.");
		} finally {
			setReading(false);
		}
	}
	return (
		<Editor
			title={item ? "Edit your inspiration" : "Pin a little inspiration"}
			description="Keep the reason behind your goal in sight. Images stay on this device."
			close={close}
		>
			<form
				className="editor-form"
				onSubmit={(e) => {
					e.preventDefault();
					save({
						...draft,
						title: draft.title.trim(),
						content: draft.content.trim(),
					});
				}}
			>
				<label>
					Title
					<input
						autoFocus
						required
						pattern={".*\\S.*"}
						maxLength={160}
						value={draft.title}
						onChange={(e) => setDraft({ ...draft, title: e.target.value })}
					/>
				</label>
				<label>
					Note or image description
					<textarea
						maxLength={2000}
						value={draft.content}
						onChange={(e) => setDraft({ ...draft, content: e.target.value })}
					/>
				</label>
				<label>
					Connect to a goal
					<select
						value={draft.goalId}
						onChange={(e) => setDraft({ ...draft, goalId: e.target.value })}
					>
						<option value="">Just inspiration</option>
						{goals.map((g) => (
							<option key={g.id} value={g.id}>
								{g.title}
							</option>
						))}
					</select>
				</label>
				<label>
					Add an image (optional, under 1 MB)
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						onChange={(e) => {
							void upload(e.target.files?.[0]);
						}}
					/>
				</label>
				{draft.image && (
					<div className="image-preview">
						<img
							src={draft.image}
							alt={draft.content || draft.title || "Image preview"}
						/>
						<button
							type="button"
							className="quiet-button"
							onClick={() => setDraft({ ...draft, image: "" })}
						>
							Remove image
						</button>
					</div>
				)}
				{error && (
					<p role="alert" className="error-text">
						{error}
					</p>
				)}
				<div className="editor-actions">
					<button type="button" className="quiet-button" onClick={close}>
						Cancel
					</button>
					<button className="primary-button" type="submit" disabled={reading}>
						{reading ? "Reading image…" : "Save inspiration"}
					</button>
				</div>
			</form>
		</Editor>
	);
}
export function TaskEditor({
	allTasks = [],
	task,
	save,
	close,
}: {
	allTasks?: Task[];
	task?: Task;
	save: (task: Task) => void;
	close: () => void;
}) {
	const [draft, setDraft] = useState<Task>(
		task ?? { id: newId(), title: "", minutes: 30, completed: false },
	);
	return (
		<Editor
			title={task ? "Edit task" : "One small next step"}
			description="Make it specific and estimate the focused time it needs."
			close={close}
		>
			<form
				className="editor-form"
				onSubmit={(e) => {
					e.preventDefault();
					save({ ...draft, title: draft.title.trim() });
				}}
			>
				<label>
					Task title
					<input
						autoFocus
						required
						pattern={".*\\S.*"}
						maxLength={160}
						value={draft.title}
						onChange={(e) => setDraft({ ...draft, title: e.target.value })}
					/>
				</label>
				<label>
					Estimated minutes
					<input
						type="number"
						required
						min="5"
						max="480"
						step="1"
						value={draft.minutes}
						onChange={(e) =>
							setDraft({ ...draft, minutes: Number(e.target.value) })
						}
					/>
				</label>
				<fieldset className="dependency-editor">
					<legend>Finish these tasks first (optional)</legend>
					<p>
						Dependencies can cross goals. Cycles are rejected when saving.
						Remove dependencies before deleting a prerequisite.
					</p>
					{allTasks
						.filter((t) => t.id !== draft.id)
						.map((t) => (
							<label key={t.id}>
								<input
									type="checkbox"
									checked={(draft.dependsOn ?? []).includes(t.id)}
									onChange={(e) =>
										setDraft({
											...draft,
											dependsOn: e.target.checked
												? [...(draft.dependsOn ?? []), t.id]
												: (draft.dependsOn ?? []).filter((id) => id !== t.id),
										})
									}
								/>
								<span>{t.title}</span>
							</label>
						))}
				</fieldset>
				<div className="editor-actions">
					<button className="quiet-button" type="button" onClick={close}>
						Cancel
					</button>
					<button className="primary-button" type="submit">
						Save task
					</button>
				</div>
			</form>
		</Editor>
	);
}
export function TitleEditor({
	title,
	save,
	close,
}: { title: string; save: (title: string) => void; close: () => void }) {
	const [value, setValue] = useState(title);
	return (
		<Editor
			title={title ? "Edit milestone" : "Add a milestone"}
			description="A milestone is a meaningful checkpoint along the way."
			close={close}
		>
			<form
				className="editor-form"
				onSubmit={(e) => {
					e.preventDefault();
					save(value.trim());
				}}
			>
				<label>
					Milestone title
					<input
						autoFocus
						required
						pattern={".*\\S.*"}
						maxLength={160}
						value={value}
						onChange={(e) => setValue(e.target.value)}
					/>
				</label>
				<div className="editor-actions">
					<button className="quiet-button" type="button" onClick={close}>
						Cancel
					</button>
					<button className="primary-button">Save milestone</button>
				</div>
			</form>
		</Editor>
	);
}
export function ConfirmEditor({
	title,
	description,
	action,
	confirm,
	close,
}: {
	title: string;
	description: string;
	action: string;
	confirm: () => void;
	close: () => void;
}) {
	return (
		<Editor title={title} description={description} close={close}>
			<div className="editor-actions">
				<button autoFocus className="quiet-button" onClick={close}>
					Cancel
				</button>
				<button className="primary-button" onClick={confirm}>
					{action}
				</button>
			</div>
		</Editor>
	);
}
