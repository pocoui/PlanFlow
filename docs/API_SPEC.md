# PlanFlow AI API 规格

基础路径：`/api`

## 创建计划

`POST /plans`

请求：

```json
{
  "title": "学习 React",
  "goal": "学习 React 基础、Hooks、路由，并完成一个小项目。",
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

响应：

```json
{
  "id": "plan_123",
  "title": "学习 React",
  "status": "draft",
  "createdAt": "2026-07-03T00:00:00.000Z"
}
```

校验规则：

- `totalMinutes` 必须为正数。
- `deadline` 必须晚于 `startDate`。
- `availability` 至少包含一个有效时间段。
- `weekday` 使用 `0` 表示周日，`6` 表示周六。
- 同一星期内的时间段不能重叠。

## 生成计划

`POST /plans/:planId/generate`

响应：

```json
{
  "planId": "plan_123",
  "tasks": [
    {
      "id": "task_1",
      "phase": "基础阶段",
      "title": "React 组件基础",
      "estimatedMinutes": 180,
      "priority": 1,
      "acceptanceCriteria": ["可以解释 JSX", "可以构建可复用组件"]
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

可能的警告：

- `INSUFFICIENT_CAPACITY`
- `AI_ESTIMATE_ADJUSTED`
- `PARTIAL_TASK_SCHEDULED`

## 获取计划详情

`GET /plans/:planId`

响应包含：

- 计划元信息
- 每周可用时间
- 任务列表
- 日程列表
- 进度汇总

## 更新任务状态

`PATCH /tasks/:taskId/status`

请求：

```json
{
  "status": "completed"
}
```

允许的状态：

- `not_started`
- `in_progress`
- `completed`
- `delayed`

## 更新日程状态

`PATCH /sessions/:sessionId/status`

请求：

```json
{
  "status": "completed"
}
```

允许的状态：

- `scheduled`
- `completed`
- `missed`
- `rescheduled`

## 导出日历

`GET /plans/:planId/calendar.ics`

响应：

- Content-Type：`text/calendar`
- 响应体：`.ics` 日历内容

错误：

- 计划不存在时返回 `404`。
- 计划没有已排程日程时返回 `409`。

## 错误结构

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "周六的可用时间段存在重叠。",
    "details": {}
  }
}
```
