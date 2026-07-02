# PlanFlow AI Data Model

## Entities

## User

MVP can use a single mock user. Keep the model future-friendly.

Fields:

- `id`
- `email`
- `name`
- `createdAt`
- `updatedAt`

## LearningPlan

Represents one learning goal and generated plan.

Fields:

- `id`
- `userId`
- `title`
- `goal`
- `totalMinutes`
- `startDate`
- `deadline`
- `status`: `draft`, `generated`, `archived`
- `createdAt`
- `updatedAt`

Relations:

- Has many `AvailabilityRule`
- Has many `LearningTask`
- Has many `ScheduledSession`

## AvailabilityRule

Represents a weekly available time range.

Fields:

- `id`
- `planId`
- `weekday`: `0` Sunday through `6` Saturday
- `startTime`: `HH:mm`
- `endTime`: `HH:mm`
- `createdAt`
- `updatedAt`

Rules:

- A plan can have zero or more rules per weekday.
- MVP requires at least one rule across the whole week.
- Rules on the same weekday cannot overlap.
- `endTime` must be later than `startTime`.

## LearningTask

Represents an AI-generated learning task.

Fields:

- `id`
- `planId`
- `phase`
- `title`
- `description`
- `estimatedMinutes`
- `priority`
- `status`: `not_started`, `in_progress`, `completed`, `delayed`
- `acceptanceCriteria`: JSON array of strings
- `orderIndex`
- `createdAt`
- `updatedAt`

## ScheduledSession

Represents one concrete calendar block.

Fields:

- `id`
- `planId`
- `taskId`
- `startAt`
- `endAt`
- `durationMinutes`
- `status`: `scheduled`, `completed`, `missed`, `rescheduled`
- `createdAt`
- `updatedAt`

Rules:

- A task can have multiple sessions.
- Sessions must be inside the plan date range.
- Sessions must be inside matching weekly availability.

## Suggested Prisma Schema

```prisma
model User {
  id        String         @id @default(cuid())
  email     String         @unique
  name      String?
  plans     LearningPlan[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model LearningPlan {
  id            String             @id @default(cuid())
  userId        String
  user          User               @relation(fields: [userId], references: [id])
  title         String
  goal          String
  totalMinutes  Int
  startDate     DateTime
  deadline      DateTime
  status        PlanStatus         @default(draft)
  availability  AvailabilityRule[]
  tasks         LearningTask[]
  sessions      ScheduledSession[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}

model AvailabilityRule {
  id        String       @id @default(cuid())
  planId    String
  plan      LearningPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  weekday   Int
  startTime String
  endTime   String
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

model LearningTask {
  id                 String             @id @default(cuid())
  planId             String
  plan               LearningPlan       @relation(fields: [planId], references: [id], onDelete: Cascade)
  phase              String
  title              String
  description        String
  estimatedMinutes   Int
  priority           Int
  status             TaskStatus         @default(not_started)
  acceptanceCriteria Json
  orderIndex         Int
  sessions           ScheduledSession[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
}

model ScheduledSession {
  id              String        @id @default(cuid())
  planId          String
  plan            LearningPlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  taskId          String
  task            LearningTask  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  startAt         DateTime
  endAt           DateTime
  durationMinutes Int
  status          SessionStatus @default(scheduled)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum PlanStatus {
  draft
  generated
  archived
}

enum TaskStatus {
  not_started
  in_progress
  completed
  delayed
}

enum SessionStatus {
  scheduled
  completed
  missed
  rescheduled
}
```
