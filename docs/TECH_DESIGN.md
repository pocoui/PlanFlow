# PlanFlow AI Technical Design

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: Prisma + SQLite
- Testing: Vitest for core logic and frontend units, Supertest for API tests
- Calendar export: `.ics` generation from scheduled sessions
- AI provider: isolated service with mock provider first, OpenAI-compatible provider later

## Repository Shape

Planned structure:

```text
apps/
  web/
    src/
  api/
    src/
packages/
  shared/
    src/
  scheduler/
    src/
docs/
prisma/
```

For a two-day MVP, this can be implemented as one TypeScript workspace with clearly separated folders. The important part is preserving boundaries between UI, API, AI planning, scheduling, and shared types.

## Frontend Architecture

Key screens:

- Plan creation screen
- Weekly availability editor
- Generated plan dashboard
- Calendar view
- Task list view

Key frontend modules:

- `PlanForm`: captures goal, total hours, start date, deadline.
- `WeeklyAvailabilityEditor`: edits weekday-based time ranges.
- `CalendarView`: displays scheduled sessions.
- `TaskList`: displays generated tasks and status.
- `PlanSummary`: displays progress and capacity information.
- API client module: wraps backend calls.

State should be kept simple for MVP:

- Component state for form editing.
- Server state fetched through API calls.
- Avoid global state unless the implementation needs it.

## Backend Architecture

Key modules:

- `plans`: create and read learning plans.
- `availability`: validate and persist weekly availability rules.
- `ai`: generate structured tasks.
- `scheduler`: create sessions from tasks and availability.
- `calendar`: export sessions as `.ics`.

Express routes should stay thin. Business logic belongs in services.

## AI Design

The AI service exposes:

```ts
generateLearningTasks(input: GenerateLearningTasksInput): Promise<GeneratedTask[]>
```

The service must:

- Accept a plan goal and target total minutes.
- Return structured tasks.
- Validate the output shape before returning.
- Support a mock implementation for development and tests.

Real provider integration should be added behind the same interface.

## Scheduling Design

The scheduler accepts:

- Tasks with estimated minutes and priority.
- Weekly availability rules.
- Start date.
- Deadline.

It returns:

- Scheduled sessions.
- Unscheduled task minutes if capacity is insufficient.
- Scheduling warnings.

Rules:

- Never schedule outside availability.
- Respect disabled weekdays.
- Support multiple ranges per weekday.
- Split tasks across sessions when task duration exceeds one slot.
- Prefer earlier available slots.
- Keep deterministic output for testability.

## Feishu Calendar Strategy

MVP:

- Export `.ics` files.
- Document Feishu Calendar as a future adapter.

Later:

- Add Feishu OAuth/app credential configuration.
- Query busy/free information if available.
- Create calendar events for scheduled sessions.
- Sync completion or reminder metadata if API support allows.

This keeps the project demonstrable even if third-party setup is blocked.

## Deployment

MVP deployment options:

- Frontend: Vercel or static hosting.
- Backend: Render, Railway, or a small Node host.
- Database: SQLite for local demo; PostgreSQL later if deployed persistently.

Environment variables:

- `DATABASE_URL`
- `AI_PROVIDER`
- `OPENAI_API_KEY` when real AI is enabled
- Feishu credentials only after real integration starts

## Error Handling

- Use schema validation for API input.
- Return typed error codes for validation, AI parsing, scheduling capacity, and export failures.
- Keep user-facing messages concise.
- Log provider errors without leaking secrets.

## Security Notes

- Do not expose API keys to the frontend.
- Store third-party tokens only on the backend when Feishu integration is implemented.
- Use mock auth or single-user mode for MVP, but keep user ownership fields in the data model for future migration.
