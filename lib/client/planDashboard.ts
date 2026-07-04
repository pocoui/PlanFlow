export interface DashboardTask {
  id: string;
  title: string;
  phase?: string;
  estimatedMinutes: number;
  status?: string;
  acceptanceCriteria?: string[];
}

export interface DashboardSession {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  durationMinutes?: number;
  status: string;
}

export interface DashboardBusySlot {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
}

export interface DashboardWarning {
  code: string;
  message: string;
  taskId?: string;
  remainingMinutes?: number;
}

export interface DashboardGeneration {
  planId: string;
  tasks: DashboardTask[];
  sessions: DashboardSession[];
  busySlots: DashboardBusySlot[];
  warnings: DashboardWarning[];
}

export interface DashboardSummary {
  totalTasks: number;
  totalSessions: number;
  scheduledMinutes: number;
  busySlots: number;
  warnings: number;
}

export interface SessionReviewPayload {
  result: "completed" | "partial" | "not_completed" | "skipped";
  actualMinutes: number;
  remainingMinutes: number;
  reason?: string;
  continueTask: boolean;
}

export type DashboardFetcher = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export function summarizeGeneratedPlan(
  generation: DashboardGeneration
): DashboardSummary {
  return {
    totalTasks: generation.tasks.length,
    totalSessions: generation.sessions.length,
    scheduledMinutes: generation.sessions.reduce(
      (total, session) => total + getSessionMinutes(session),
      0
    ),
    busySlots: generation.busySlots.length,
    warnings: generation.warnings.length
  };
}

export function groupSessionsByDate(sessions: DashboardSession[]) {
  const grouped = new Map<string, DashboardSession[]>();

  sessions
    .slice()
    .sort(
      (first, second) =>
        new Date(first.startAt).getTime() - new Date(second.startAt).getTime()
    )
    .forEach((session) => {
      const date = session.startAt.slice(0, 10);
      const dateSessions = grouped.get(date) ?? [];
      dateSessions.push(session);
      grouped.set(date, dateSessions);
    });

  return Array.from(grouped.entries()).map(([date, dateSessions]) => ({
    date,
    sessions: dateSessions
  }));
}

export async function markTaskCompleted(
  taskId: string,
  fetcher: DashboardFetcher = fetch
): Promise<{ id: string; status: string }> {
  return patchStatus(`/api/tasks/${taskId}/status`, fetcher);
}

export async function markSessionCompleted(
  sessionId: string,
  fetcher: DashboardFetcher = fetch
): Promise<{ id: string; status: string }> {
  return patchStatus(`/api/sessions/${sessionId}/status`, fetcher);
}

export async function submitSessionReview(
  sessionId: string,
  payload: SessionReviewPayload,
  fetcher: DashboardFetcher = fetch
): Promise<{
  reviewId: string;
  sessionId: string;
  taskId: string;
  rescheduledSessions: DashboardSession[];
  warnings: DashboardWarning[];
}> {
  const response = await fetcher(`/api/sessions/${sessionId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseJsonResponse(response);
}

export function buildCalendarExportUrl(planId: string): string {
  return `/api/plans/${planId}/calendar.ics`;
}

function getSessionMinutes(session: DashboardSession): number {
  if (typeof session.durationMinutes === "number") {
    return session.durationMinutes;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) /
        60000
    )
  );
}

async function patchStatus(
  url: string,
  fetcher: DashboardFetcher
): Promise<{ id: string; status: string }> {
  const response = await fetcher(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "completed" })
  });

  return parseJsonResponse(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(body) ?? "Request failed.");
  }

  return body as T;
}

function getErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return null;
  }

  const error = body.error;

  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
}
