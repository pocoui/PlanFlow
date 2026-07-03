# PlanFlow AI 数据模型

## 实体

## User

MVP 可以使用单个 mock 用户，但模型保留后续扩展空间。

字段：

- `id`
- `email`
- `name`
- `createdAt`
- `updatedAt`

## LearningPlan

表示一个学习目标和它生成后的计划。

字段：

- `id`
- `userId`
- `title`
- `goal`
- `totalMinutes`
- `startDate`
- `deadline`
- `rescheduleBufferMinutes`
- `status`：`draft`、`generated`、`archived`
- `createdAt`
- `updatedAt`

关系：

- 拥有多个 `AvailabilityRule`
- 拥有多个 `LearningTask`
- 拥有多个 `ScheduledSession`

## AvailabilityRule

表示一个每周重复的可用时间段。

字段：

- `id`
- `planId`
- `weekday`：`0` 表示周日，`6` 表示周六
- `startTime`：`HH:mm`
- `endTime`：`HH:mm`
- `createdAt`
- `updatedAt`

规则：

- 一个计划在每个星期可以有 0 个或多个规则。
- MVP 要求整个星期至少有一个可用时间段。
- 同一星期内的规则不能重叠。
- `endTime` 必须晚于 `startTime`。

## LearningTask

表示 AI 生成的学习任务。

字段：

- `id`
- `planId`
- `phase`
- `title`
- `description`
- `estimatedMinutes`
- `priority`
- `status`：`not_started`、`in_progress`、`completed`、`delayed`
- `acceptanceCriteria`：字符串数组，使用 JSON 存储
- `orderIndex`
- `createdAt`
- `updatedAt`

关系：

- 拥有多个 `ScheduledSession`
- 拥有多个 `SessionReview`

## ScheduledSession

表示一个具体日历时间块。

字段：

- `id`
- `planId`
- `taskId`
- `startAt`
- `endAt`
- `durationMinutes`
- `status`：`scheduled`、`completed`、`missed`、`rescheduled`
- `externalEventId`
- `createdAt`
- `updatedAt`

规则：

- 一个任务可以对应多个日程。
- 日程必须位于计划日期范围内。
- 日程必须位于匹配的每周可用时间段内。
- 日程不能与外部忙碌时间冲突。
- 冲突后顺延生成的新日程必须遵守计划的 `rescheduleBufferMinutes`。

## BusySlot

表示从日历 provider 获取到的外部忙碌时间。

字段：

- `id`
- `planId`
- `source`：例如 `mock_feishu` 或 `feishu`
- `externalEventId`
- `title`
- `startAt`
- `endAt`
- `createdAt`
- `updatedAt`

规则：

- MVP 可以由 `MockFeishuCalendarProvider` 生成忙碌时间。
- 真实飞书接入后，可以缓存查询结果，便于调试和展示。

## SessionReview

表示学习日程结束后的复盘。

字段：

- `id`
- `sessionId`
- `taskId`
- `result`：`completed`、`partial`、`not_completed`、`skipped`
- `actualMinutes`
- `remainingMinutes`
- `reason`
- `continueTask`
- `createdAt`

规则：

- `partial`、`not_completed`、`skipped` 会触发顺延。
- `remainingMinutes` 会重新进入排程队列。

## 建议 Prisma Schema

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
  rescheduleBufferMinutes Int @default(15)
  status        PlanStatus         @default(draft)
  availability  AvailabilityRule[]
  tasks         LearningTask[]
  sessions      ScheduledSession[]
  busySlots     BusySlot[]
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
  reviews            SessionReview[]
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
  externalEventId String?
  review          SessionReview?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model BusySlot {
  id              String       @id @default(cuid())
  planId          String
  plan            LearningPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  source          String
  externalEventId String?
  title           String
  startAt         DateTime
  endAt           DateTime
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model SessionReview {
  id               String           @id @default(cuid())
  sessionId        String           @unique
  session          ScheduledSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  taskId           String
  task             LearningTask     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  result           ReviewResult
  actualMinutes    Int
  remainingMinutes Int
  reason           String?
  continueTask     Boolean          @default(true)
  createdAt        DateTime         @default(now())
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
  conflicted
}

enum ReviewResult {
  completed
  partial
  not_completed
  skipped
}
```
