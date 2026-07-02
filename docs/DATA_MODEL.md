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
- `createdAt`
- `updatedAt`

规则：

- 一个任务可以对应多个日程。
- 日程必须位于计划日期范围内。
- 日程必须位于匹配的每周可用时间段内。

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
