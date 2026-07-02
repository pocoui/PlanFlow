# PlanFlow AI PRD

## Background

PlanFlow AI is a learning planning assistant that turns a learning goal into an executable calendar plan. The first version focuses on helping users plan technical learning, such as "learn React in 30 hours", without becoming a broad Notion-style task manager.

## Target Users

- Frontend developers learning a new framework or stack.
- Job seekers preparing structured learning plans.
- Independent learners who have fragmented weekly availability.

## Core Pain Points

- Users know the learning goal but do not know how to split it into realistic tasks.
- Users have uneven free time across the week, not the same time every day.
- Generic todo apps do not decide when a task should happen.
- Calendar reminders are useful, but third-party calendar integration can be heavy for a first release.

## Product Positioning

PlanFlow AI is not a generic todo app. It is an AI learning plan and calendar scheduling assistant.

The product promise is:

> Enter a learning goal and weekly availability. PlanFlow AI generates structured learning tasks and schedules them into a realistic calendar.

## MVP Features

### Learning Plan Creation

Users can create a plan with:

- Plan title
- Learning goal description
- Total learning hours
- Start date
- Deadline
- Weekly availability rules

Acceptance criteria:

- User can create a plan from a form.
- Total hours must be greater than 0.
- Deadline must be after start date.
- At least one weekly availability time range is required.

### Weekly Availability Configuration

Users configure available learning time by weekday:

- Monday through Sunday can be enabled or disabled independently.
- Each weekday supports zero or more time ranges.
- Example: Saturday can include `09:00-12:00` and `14:00-16:00`.

Acceptance criteria:

- A weekday can have no availability.
- A weekday can have multiple availability ranges.
- Invalid ranges, such as end time before start time, are rejected.
- Overlapping ranges on the same weekday are rejected.

### AI Task Decomposition

The system converts the learning goal into tasks.

Each task includes:

- Phase
- Title
- Description
- Estimated minutes
- Priority
- Acceptance criteria

Acceptance criteria:

- AI output is parsed into structured tasks.
- The sum of estimated minutes should approximate the requested total hours.
- Invalid AI output is rejected with a user-friendly error.
- The AI service is isolated from business route handlers.

### Automatic Scheduling

The scheduler places tasks into available weekly time ranges between start date and deadline.

Acceptance criteria:

- Sessions are only generated inside user-configured availability.
- Longer tasks can be split across multiple sessions.
- Sessions include start time, end time, linked task, and status.
- If available time is insufficient, unscheduled task time is reported clearly.

### Calendar and Task Views

The UI shows:

- Plan overview
- Today's learning sessions
- Weekly calendar
- Task list
- Progress summary

Acceptance criteria:

- User can see which sessions are scheduled on each date.
- User can mark tasks or sessions as completed.
- Progress updates after completion.
- Empty, loading, and error states are visible.

### Calendar Export

Users can export scheduled sessions as an `.ics` file.

Acceptance criteria:

- Export includes all scheduled sessions.
- Calendar event title includes the learning task title.
- Event description includes plan name and acceptance criteria.
- Export is available even without Feishu integration.

## Non-MVP Features

- Real Feishu Calendar OAuth and event creation.
- Multi-user teams.
- Payments.
- Advanced recommendation engine.
- Mobile app.
- Full RBAC.
- Plugin system.

## User Flow

1. User opens PlanFlow AI.
2. User creates a learning plan.
3. User configures weekly availability by weekday.
4. User clicks generate plan.
5. AI creates structured learning tasks.
6. Scheduler creates calendar sessions.
7. User reviews calendar and task list.
8. User completes sessions and tracks progress.
9. User exports `.ics` calendar file.

## Success Metrics

- User can generate a complete schedule in less than 3 minutes.
- A 30-hour learning goal can be scheduled across uneven weekly availability.
- The generated plan is understandable enough to explain in an interview demo.
- The MVP remains usable if real AI or Feishu API is unavailable by using mock AI and `.ics` export.
