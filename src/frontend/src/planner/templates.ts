type Phase = [string, [string, number][]];
export const templates: Record<
	"project" | "learning" | "creative" | "custom",
	Phase[]
> = {
	project: [
		[
			"Discover and define",
			[
				["Write the problem statement and measurable acceptance criteria", 30],
				["Sketch the core workflow and data model", 45],
				["Choose a small release scope and list implementation risks", 30],
			],
		],
		[
			"Build and verify",
			[
				["Implement the smallest complete workflow", 90],
				["Test success, invalid input, and failure recovery", 60],
				["Review accessibility and improve the weakest interaction", 60],
			],
		],
		[
			"Share and reflect",
			[
				["Ask someone to try the complete workflow", 30],
				["Apply feedback and record a demonstration", 60],
				["Write the architecture, setup instructions, and limitations", 45],
			],
		],
	],
	learning: [
		[
			"Find your starting point",
			[
				["Define a skill you can demonstrate and a way to assess it", 30],
				["Try a baseline exercise and record knowledge gaps", 45],
				["Choose one learning resource and three practice exercises", 30],
			],
		],
		[
			"Practice deliberately",
			[
				["Study one concept and explain it in your own words", 45],
				["Complete a practice exercise without following a solution", 60],
				["Review mistakes and repeat the most difficult exercise", 60],
			],
		],
		[
			"Demonstrate understanding",
			[
				["Build a small independent example using the skill", 90],
				["Assess the result against your original success criteria", 30],
				["Record what you learned and select your next challenge", 30],
			],
		],
	],
	creative: [
		[
			"Shape the idea",
			[
				["Describe the audience, purpose, and finished artifact", 30],
				["Gather references and identify the scope of the first version", 45],
				["Sketch or outline three possible approaches and choose one", 45],
			],
		],
		[
			"Create and refine",
			[
				["Produce a complete rough first version", 90],
				["Review the work against the intended experience", 30],
				["Refine one important weakness without expanding scope", 60],
			],
		],
		[
			"Finish and share",
			[
				["Get feedback from a trusted reviewer", 30],
				["Make final revisions and prepare the finished artifact", 60],
				["Share the result and record lessons for the next project", 30],
			],
		],
	],
	custom: [
		[
			"Define the destination",
			[
				["Define what success means for this goal", 30],
				["List the resources, skills, and support you need", 45],
				["Choose one small deliverable and write its acceptance criteria", 30],
			],
		],
		[
			"Build a first version",
			[
				["Complete a focused first attempt at your deliverable", 90],
				["Review the result against your acceptance criteria", 30],
				["Improve the weakest part with another focused attempt", 90],
			],
		],
		[
			"Reflect and finish",
			[
				["Get feedback from someone you trust", 30],
				["Apply feedback and complete your deliverable", 60],
				["Record the result and choose your next step", 30],
			],
		],
	],
};
