export interface AvailabilityWindow {
	id: string;
	weekday: number;
	start: string;
	end: string;
}
export interface Commitment {
	id: string;
	date: string;
	start: string;
	end: string;
	title: string;
}
export interface ScheduleSettings {
	timezone: string;
	horizonDays: number;
	sessionMinutes: number;
	breakMinutes: number;
	windows: AvailabilityWindow[];
	commitments: Commitment[];
}
export interface Session {
	id: string;
	taskId: string;
	goalId: string;
	title: string;
	start: string;
	end: string;
}
export interface Unscheduled {
	taskId: string;
	title: string;
	remainingMinutes: number;
	reason: "DEPENDENCY_BLOCKED" | "INSUFFICIENT_CAPACITY" | "DEADLINE_PASSED";
}
export interface Schedule {
	id: string;
	algorithm: "earliest-deadline-v1";
	createdAt: string;
	inputRevision: string;
	sessions: Session[];
	unscheduled: Unscheduled[];
	warnings: string[];
}
export interface PlanningState {
	settings: ScheduleSettings;
	accepted?: Schedule;
	history: Schedule[];
}
export function defaultSettings(): ScheduleSettings {
	return {
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
		horizonDays: 28,
		sessionMinutes: 60,
		breakMinutes: 10,
		windows: [],
		commitments: [],
	};
}
