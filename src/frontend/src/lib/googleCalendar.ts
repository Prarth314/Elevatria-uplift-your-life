import { getGoogleConfig } from "@/config/googleConfig";
import type { ElevatriaTask } from "@/lib/CalendarTypes";
import {
  clearCalendarToken,
  syncTaskToGoogleCalendar,
} from "@/lib/GoogleCalendarService";

/**
 * Clears cached OAuth token material from encrypted session storage and memory.
 */
export function clearToken(): void {
  clearCalendarToken();
}

export function parseRoadmapDays(
  roadmapText: string,
): Array<{ day: number; title: string; tasks: string[] }> {
  const days: Array<{ day: number; title: string; tasks: string[] }> = [];
  const dayRegex = /(?:\*{0,2})Day\s+(\d+)(?:\*{0,2})[:\s\u2013-]+([^\n]*)/gi;
  const segments: Array<{ day: number; title: string; startIdx: number }> = [];
  let m = dayRegex.exec(roadmapText);
  while (m !== null) {
    segments.push({
      day: Number.parseInt(m[1]),
      title: m[2].trim() || `Day ${m[1]}`,
      startIdx: m.index + m[0].length,
    });
    m = dayRegex.exec(roadmapText);
  }
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const end =
      i + 1 < segments.length ? segments[i + 1].startIdx : roadmapText.length;
    const body = roadmapText.slice(seg.startIdx, end);
    const tasks = body
      .split("\n")
      .map((l) => l.replace(/^[\s\-*\u2022]+/, "").trim())
      .filter((l) => l.length > 0 && !l.match(/^Day\s+\d+/i))
      .slice(0, 3);
    days.push({ day: seg.day, title: seg.title, tasks });
  }
  if (days.length === 0) {
    return [
      {
        day: 1,
        title: "Elevatria 7-Day Roadmap",
        tasks: [roadmapText.slice(0, 200)],
      },
    ];
  }
  return days;
}

export interface LegacyCalendarEventDetails {
  title: string;
  description: string;
}

/**
 * Converts roadmap text into typed task items so sync can validate start/end/date rules.
 */
function roadmapToTasks(
  days: Array<{ day: number; title: string; tasks: string[] }>,
  getEventDetails: (taskName: string) => LegacyCalendarEventDetails,
): ElevatriaTask[] {
  const now = new Date();
  return days.map((dayData) => {
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + dayData.day);
    const details = getEventDetails(dayData.title);
    const end = new Date(baseDate.getTime() + 60 * 60 * 1000);
    return {
      id: `roadmap-day-${dayData.day}`,
      title: details.title,
      description: `${details.description}\n\n${dayData.tasks.join("\n")}`.trim(),
      createdAt: baseDate.toISOString(),
      endAt: end.toISOString(),
      roadmapDay: dayData.day,
    };
  });
}

/**
 * Syncs parsed roadmap tasks with dual-commit semantics:
 * Google insert first, then canister persistence of the Google event id.
 */
export async function syncRoadmapToCalendarWithAutoReauth(
  days: Array<{ day: number; title: string; tasks: string[] }>,
  getEventDetails: (taskName: string) => LegacyCalendarEventDetails,
): Promise<void> {
  const { clientId } = getGoogleConfig();
  const tasks = roadmapToTasks(days, getEventDetails);
  for (const task of tasks) {
    await syncTaskToGoogleCalendar(task, clientId);
  }
}
