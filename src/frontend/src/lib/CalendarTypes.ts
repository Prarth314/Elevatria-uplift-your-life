export interface ElevatriaTask {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
  deadline?: string;
  startAt?: string;
  endAt?: string;
  roadmapDay?: number;
}

export interface GoogleEventDateTime {
  dateTime: string;
  timeZone: string;
}

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface SyncResult {
  taskId: string;
  googleEventId: string;
}
