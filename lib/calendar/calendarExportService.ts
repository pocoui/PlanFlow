interface CalendarExportPlan {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    acceptanceCriteria: string[];
  }>;
}

interface CalendarExportSession {
  id: string;
  taskId: string;
  startAt: Date;
  endAt: Date;
}

export function buildIcsCalendar(
  plan: CalendarExportPlan,
  sessions: CalendarExportSession[]
): string {
  const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlanFlow AI//PlanFlow AI MVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  sessions
    .slice()
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .forEach((session) => {
      const task = taskById.get(session.taskId);
      const title = task?.title ?? "Learning session";
      const criteria = task?.acceptanceCriteria.join("; ") ?? "";
      const description = `Plan: ${plan.title}\\nAcceptance criteria: ${criteria}`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(`${session.id}@planflow.local`)}`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(session.startAt)}`,
        `DTEND:${formatIcsDate(session.endAt)}`,
        `SUMMARY:${escapeIcsText(title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        "END:VEVENT"
      );
    });

  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
