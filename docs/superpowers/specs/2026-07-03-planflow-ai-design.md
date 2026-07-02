# PlanFlow AI Design

## Product Direction

PlanFlow AI is an AI learning planning and calendar scheduling assistant. It helps users turn a natural language learning goal, such as "learn React", into structured learning tasks and scheduled calendar blocks.

The MVP targets individual learners, frontend developers switching stacks, and job seekers who need a realistic plan rather than another generic todo list.

## Core Problem

Users often know what they want to learn and roughly how much time they can invest, but they do not know how to break the goal into executable tasks or how to fit those tasks into uneven weekly availability.

PlanFlow AI solves this by combining:

- AI task decomposition
- Weekly availability rules
- Deterministic scheduling
- Calendar display and export

## MVP Scope

The MVP includes:

- Create a learning plan with title, goal description, total hours, start date, deadline, and weekly availability.
- Configure availability by weekday. Each weekday can have zero or more time ranges.
- Generate structured learning tasks with title, description, estimated minutes, priority, phase, and acceptance criteria.
- Schedule tasks only inside available weekday time ranges.
- Split longer tasks across multiple available slots when needed.
- Display a plan overview, task list, today's tasks, and calendar schedule.
- Track task status: not started, in progress, completed, and delayed.
- Export scheduled sessions as an `.ics` calendar file.

The MVP does not require real Feishu Calendar synchronization. Feishu integration is documented as a later enhancement so third-party OAuth and app review do not block the first release.

## Recommended Architecture

Use a small full-stack TypeScript application:

- Frontend: React + TypeScript
- Backend: Node + Express + TypeScript
- Database: Prisma + SQLite
- AI integration: isolated service that returns validated structured output
- Scheduling: isolated pure module that can be unit tested
- Calendar export: isolated `.ics` generator module

The key boundaries are:

- `aiPlanningService`: turns a learning goal into structured tasks.
- `scheduler`: turns tasks and weekly availability into calendar sessions.
- `calendarExportService`: turns sessions into an `.ics` file.
- API layer: validates input and persists plans, tasks, availability, and sessions.
- React UI: manages plan creation, availability editing, calendar display, and status updates.

## Data Flow

1. User creates a learning plan and weekly availability rules.
2. Backend validates the request and stores the plan draft.
3. AI service generates structured learning tasks.
4. Backend validates AI output and stores tasks.
5. Scheduler reads tasks and weekly availability, then creates scheduled sessions before the deadline.
6. Frontend displays the generated calendar and task list.
7. User updates completion status.
8. User exports an `.ics` file, or later syncs to Feishu Calendar.

## Error Handling

- Invalid weekly availability returns validation errors before scheduling.
- Overlapping time ranges on the same weekday are rejected.
- Total available time before the deadline is compared with total task duration.
- If capacity is insufficient, the scheduler returns a partial schedule plus unscheduled tasks.
- AI output must be parsed and validated before persistence.
- Calendar export must fail clearly if no scheduled sessions exist.

## Testing Focus

- Weekly availability validation.
- Scheduling across uneven weekday slots.
- Splitting tasks across multiple sessions.
- Capacity shortage behavior.
- AI output schema validation.
- API request and response contracts.
- Main frontend flow: create plan, generate tasks, view schedule, complete task, export calendar.

## Open Decisions

- The first implementation can use a mock AI provider with the same response shape, then add real OpenAI integration behind the service boundary.
- Authentication can be mocked or single-user for MVP.
- Feishu Calendar should start as a documented adapter interface, with `.ics` export as the working MVP integration.
