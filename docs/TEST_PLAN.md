# PlanFlow AI Test Plan

## Test Strategy

Focus tests on the parts that make the project more than a todo app:

- Weekly availability validation
- Scheduling algorithm
- AI output validation
- API contracts
- Main frontend flow
- Calendar export

## Unit Tests

### Availability Validation

Cases:

- Accepts one valid weekday range.
- Accepts multiple non-overlapping ranges on the same weekday.
- Accepts weekdays with no ranges.
- Rejects end time earlier than start time.
- Rejects equal start and end time.
- Rejects overlapping ranges.
- Rejects invalid weekday values.

### Scheduler

Cases:

- Schedules tasks only inside configured availability.
- Skips disabled weekdays.
- Uses multiple ranges on a weekday.
- Splits long tasks across sessions.
- Schedules earlier available slots first.
- Returns unscheduled minutes when capacity is insufficient.
- Produces deterministic output for the same input.

### AI Output Validation

Cases:

- Accepts valid generated tasks.
- Rejects missing title.
- Rejects non-positive estimated minutes.
- Rejects empty acceptance criteria.
- Warns if total generated minutes differs too much from target.

### Calendar Export

Cases:

- Generates valid `.ics` content for sessions.
- Includes task title in event summary.
- Includes plan title and acceptance criteria in event description.
- Fails clearly when no sessions exist.

## API Tests

### `POST /api/plans`

Cases:

- Creates a plan with valid availability.
- Rejects invalid deadline.
- Rejects empty availability.
- Rejects overlapping ranges.

### `POST /api/plans/:planId/generate`

Cases:

- Generates tasks and sessions.
- Returns warnings when capacity is insufficient.
- Returns 404 for missing plan.

### `GET /api/plans/:planId`

Cases:

- Returns plan detail with tasks, sessions, availability, and progress.
- Returns 404 for missing plan.

### Status Updates

Cases:

- Updates task status.
- Updates session status.
- Rejects invalid status.

### Calendar Export

Cases:

- Returns `text/calendar`.
- Returns 409 when plan has no sessions.

## Frontend Verification

Manual browser checks:

- Plan creation happy path.
- Weekly availability add and remove.
- Validation errors for bad time ranges.
- Generated plan loading state.
- Generated plan error state.
- Calendar view on desktop.
- Calendar view on mobile.
- Mark session completed.
- Export `.ics`.

## Build Verification

Before claiming a stage complete:

- Run all unit tests.
- Run API tests.
- Run typecheck.
- Run production build.
- Check Git status.
