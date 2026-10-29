const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

/**
 * Centralized Google OAuth configuration so auth failures are detected at startup.
 */
export function getGoogleConfig(): { clientId: string } {
  if (!VITE_GOOGLE_CLIENT_ID) {
    throw new Error("Missing Google Config");
  }
  return { clientId: VITE_GOOGLE_CLIENT_ID };
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;
