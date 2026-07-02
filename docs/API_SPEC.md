# PlanFlow AI API Spec

Base path: `/api`

## Create Plan

`POST /plans`

Request:

```json
{
  "title": "Learn React",
  "goal": "Learn React fundamentals, hooks, routing, and build a small project.",
  "totalMinutes": 1800,
  "startDate": "2026-07-03",
  "deadline": "2026-07-20",
  "availability": [
    { "weekday": 1, "startTime": "20:00", "endTime": "22:00" },
    { "weekday": 3, "startTime": "19:30", "endTime": "21:30" },
    { "weekday": 6, "startTime": "09:00", "endTime": "12:00" },
    { "weekday": 6, "startTime": "14:00", "endTime": "16:00" }
  ]
}
```

Response:

```json
{
  "id": "plan_123",
  "title": "Learn React",
  "status": "draft",
  "createdAt": "2026-07-03T00:00:00.000Z"
}
```

Validation:

- `totalMinutes` must be positive.
- `deadline` must be after `startDate`.
- `availability` must contain at least one valid time range.
- `weekday` uses `0` for Sunday through `6` for Saturday.
- Time ranges on the same weekday must not overlap.

## Generate Plan

`POST /plans/:planId/generate`

Response:

```json
{
  "planId": "plan_123",
  "tasks": [
    {
      "id": "task_1",
      "phase": "Foundation",
      "title": "React component basics",
      "estimatedMinutes": 180,
      "priority": 1,
      "acceptanceCriteria": ["Can explain JSX", "Can build a reusable component"]
    }
  ],
  "sessions": [
    {
      "id": "session_1",
      "taskId": "task_1",
      "startAt": "2026-07-06T20:00:00.000+08:00",
      "endAt": "2026-07-06T22:00:00.000+08:00",
      "status": "scheduled"
    }
  ],
  "warnings": []
}
```

Possible warnings:

- `INSUFFICIENT_CAPACITY`
- `AI_ESTIMATE_ADJUSTED`
- `PARTIAL_TASK_SCHEDULED`

## Get Plan Detail

`GET /plans/:planId`

Response includes:

- Plan metadata
- Weekly availability
- Tasks
- Sessions
- Progress summary

## Update Task Status

`PATCH /tasks/:taskId/status`

Request:

```json
{
  "status": "completed"
}
```

Allowed statuses:

- `not_started`
- `in_progress`
- `completed`
- `delayed`

## Update Session Status

`PATCH /sessions/:sessionId/status`

Request:

```json
{
  "status": "completed"
}
```

Allowed statuses:

- `scheduled`
- `completed`
- `missed`
- `rescheduled`

## Export Calendar

`GET /plans/:planId/calendar.ics`

Response:

- Content-Type: `text/calendar`
- Body: `.ics` calendar content

Errors:

- `404` if plan does not exist.
- `409` if plan has no scheduled sessions.

## Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Availability ranges overlap on Saturday.",
    "details": {}
  }
}
```
