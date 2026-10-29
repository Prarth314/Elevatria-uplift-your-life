import { GOOGLE_CALENDAR_SCOPES } from "@/config/googleConfig";
import { createActorWithConfig } from "@/config";
import type {
  ElevatriaTask,
  GoogleEventPayload,
  GoogleTokenResponse,
  SyncResult,
} from "@/lib/CalendarTypes";

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const TOKEN_STORE_KEY = "elevatria_google_token_encrypted";
const TOKEN_SCOPE_SET = new Set(GOOGLE_CALENDAR_SCOPES);
const DEFAULT_DURATION_MINUTES = 60;

type OAuthTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type OAuth2Api = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: () => void;
  }) => OAuthTokenClient;
};

interface GISWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: OAuth2Api;
    };
  };
}

interface SessionToken {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

let inMemoryToken: SessionToken | null = null;
let sessionCryptoKey: CryptoKey | null = null;

function isExpired(token: SessionToken | null): boolean {
  return !token || Date.now() >= token.expiresAt;
}

/**
 * Loads the GIS SDK once so the token client can run in all environments.
 */
async function ensureGoogleIdentityScript(): Promise<void> {
  if (document.querySelector(`script[src="${GIS_SCRIPT}"]`)) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity"));
    document.head.appendChild(script);
  });
}

/**
 * Keeps the token encrypted in sessionStorage while the crypto key remains in memory.
 * This prevents plain-text token leakage from local/session storage snapshots.
 */
async function getSessionCryptoKey(): Promise<CryptoKey> {
  if (sessionCryptoKey) return sessionCryptoKey;
  sessionCryptoKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return sessionCryptoKey;
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

/**
 * Encrypts and stores the session token so we avoid plain-token persistence.
 */
async function persistEncryptedToken(token: SessionToken): Promise<void> {
  const key = await getSessionCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify(token));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  const stored = JSON.stringify({
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  });
  sessionStorage.setItem(TOKEN_STORE_KEY, stored);
}

/**
 * Attempts to read and decrypt a previously stored token for this browser tab session.
 */
async function readEncryptedToken(): Promise<SessionToken | null> {
  if (!sessionCryptoKey) return null;
  const raw = sessionStorage.getItem(TOKEN_STORE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { iv: string; data: string };
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(parsed.iv) },
      sessionCryptoKey,
      fromBase64(parsed.data),
    );
    const token = JSON.parse(new TextDecoder().decode(decrypted)) as SessionToken;
    return isExpired(token) ? null : token;
  } catch {
    sessionStorage.removeItem(TOKEN_STORE_KEY);
    return null;
  }
}

/**
 * Clears in-memory and encrypted session token states when auth becomes invalid.
 */
export function clearCalendarToken(): void {
  inMemoryToken = null;
  sessionStorage.removeItem(TOKEN_STORE_KEY);
}

function hasRequiredScopes(scope: string): boolean {
  const granted = new Set(scope.split(" ").filter(Boolean));
  for (const required of TOKEN_SCOPE_SET) {
    if (!granted.has(required)) return false;
  }
  return true;
}

/**
 * Ensures we hold a non-expired access token with both calendar scopes.
 * It uses incremental authorization: silent first, then explicit consent if needed.
 */
export async function ensureCalendarAccessToken(clientId: string): Promise<string> {
  if (!isExpired(inMemoryToken) && hasRequiredScopes(inMemoryToken.scope)) {
    return inMemoryToken.accessToken;
  }

  const fromSession = await readEncryptedToken();
  if (!isExpired(fromSession) && fromSession && hasRequiredScopes(fromSession.scope)) {
    inMemoryToken = fromSession;
    return fromSession.accessToken;
  }

  await ensureGoogleIdentityScript();
  const gis = (window as GISWindow).google?.accounts?.oauth2;
  if (!gis) throw new Error("Google OAuth SDK unavailable");

  const runTokenFlow = (prompt: "" | "consent"): Promise<SessionToken> =>
    new Promise((resolve, reject) => {
      const tokenClient = gis.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CALENDAR_SCOPES.join(" "),
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || "OAuth token request failed"));
            return;
          }
          const token: SessionToken = {
            accessToken: response.access_token,
            expiresAt: Date.now() + Math.max((response.expires_in ?? 3600) - 60, 30) * 1000,
            scope: response.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
          };
          resolve(token);
        },
      });
      tokenClient.requestAccessToken({ prompt });
    });

  let token: SessionToken;
  try {
    token = await runTokenFlow("");
  } catch {
    token = await runTokenFlow("consent");
  }

  if (!hasRequiredScopes(token.scope)) {
    token = await runTokenFlow("consent");
    if (!hasRequiredScopes(token.scope)) {
      throw new Error("Missing required calendar scopes");
    }
  }

  inMemoryToken = token;
  await persistEncryptedToken(token);

  // Persist only linked state on-chain, never OAuth credentials.
  try {
    const actor = await createActorWithConfig();
    await actor.setCalendarLinked(true);
  } catch {
    // Non-fatal: calendar sync can still proceed if canister write is unavailable.
  }

  return token.accessToken;
}

/**
 * Uses UTC canister timestamps and browser timezone to build a user-correct event slot.
 * If no end-time exists, it generates a logical 60-minute duration.
 */
export function toGoogleEventPayload(task: ElevatriaTask): GoogleEventPayload {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const startSource = task.startAt ?? task.createdAt ?? task.deadline ?? new Date().toISOString();
  const endSource = task.endAt ?? task.deadline;
  const startDate = new Date(startSource);
  const endDate = endSource
    ? new Date(endSource)
    : new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  const safeEndDate = endDate > startDate
    ? endDate
    : new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);

  return {
    summary: task.title,
    description: task.description ?? "",
    start: { dateTime: startDate.toISOString(), timeZone },
    end: { dateTime: safeEndDate.toISOString(), timeZone },
  };
}

async function insertCalendarEvent(
  accessToken: string,
  payload: GoogleEventPayload,
): Promise<{ id: string }> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const err = new Error(`Google Calendar API error: ${response.status}`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  return (await response.json()) as { id: string };
}

/**
 * Retries transient rate-limit/network failures with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (attempt >= retries || (status !== 429 && status !== undefined)) {
        throw error;
      }
      const waitMs = 2 ** attempt * 500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempt++;
    }
  }
}

/**
 * Dual-commit sync:
 * 1) write event to Google, 2) persist google_event_id in ICP backend.
 */
export async function syncTaskToGoogleCalendar(
  task: ElevatriaTask,
  clientId: string,
): Promise<SyncResult> {
  let token = await ensureCalendarAccessToken(clientId);
  const payload = toGoogleEventPayload(task);

  const insertEvent = async () => withRetry(() => insertCalendarEvent(token, payload));

  let event;
  try {
    event = await insertEvent();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      clearCalendarToken();
      token = await ensureCalendarAccessToken(clientId);
      event = await insertEvent();
    } else {
      throw error;
    }
  }

  const actor = await createActorWithConfig();
  await actor.recordGoogleEventLink(task.id, event.id);

  return { taskId: task.id, googleEventId: event.id };
}
