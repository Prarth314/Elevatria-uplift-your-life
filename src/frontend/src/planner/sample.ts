import { dateAfter, newId } from "./model.ts";
import type { Workspace, Milestone } from "./model.ts";
export function sampleWorkspace(): Workspace {
	const phases: [string, [string, number, boolean][]][] = [
		[
			"Find a problem worth solving",
			[
				["Interview two students about their study planning habits", 45, true],
				["Write a one-page problem statement and success criteria", 30, true],
				["Sketch the study assistant’s core screen and data flow", 45, false],
			],
		],
		[
			"Build the study assistant",
			[
				["Build a React form for notes and study preferences", 90, false],
				[
					"Add a server endpoint with a validated AI response schema",
					120,
					false,
				],
				["Test empty input, API failures, and malformed responses", 90, false],
			],
		],
		[
			"Make it portfolio ready",
			[
				["Ask two classmates to try the complete workflow", 45, false],
				["Fix usability issues and record a short demo", 60, false],
				[
					"Write a README with architecture, evaluation, and limitations",
					60,
					false,
				],
			],
		],
	];
	const milestones: Milestone[] = phases.map(([title, tasks]) => ({
		id: newId(),
		title,
		tasks: tasks.map(([title, minutes, completed]) => ({
			id: newId(),
			title,
			minutes,
			completed,
		})),
	}));
	const goalId = newId();
	return {
		version: 1,
		goals: [
			{
				id: goalId,
				title: "Build an AI study assistant",
				description:
					"Turn class notes into a useful study plan. Ship one thoughtful project I can explain with confidence in an internship interview.",
				targetDate: dateAfter(35),
				weeklyHours: 4,
				constraints:
					"Classes come first. Keep scope to one notes-to-study-plan workflow. No paid services for the prototype.",
				color: "forest",
				milestones,
			},
		],
		items: [
			{
				id: newId(),
				title: "Build something that matters.",
				content:
					"Small steps. Real progress. A little more belief in what I can create.",
				image: "",
				goalId,
			},
			{
				id: newId(),
				title: "My north star",
				content:
					"A portfolio that shows how I think, not just what I can build.",
				image: "",
				goalId,
			},
		],
	};
}
