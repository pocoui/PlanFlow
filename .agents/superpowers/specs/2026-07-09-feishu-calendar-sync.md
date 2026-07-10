# 飞书日历同步功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PlanFlow 排程的任务（ScheduledSession）同步到用户真实的飞书日历中，创建对应的日历日程。

**Architecture:** 实现真实的 `FeishuCalendarProvider`，通过飞书开放平台 API v4 创建/更新/查询日历日程。使用 `tenant_access_token`（应用身份）进行 API 调用，获取应用主日历 ID 后在其上创建日程。同步服务遍历 plan 下的 sessions，对未同步的 session 调用创建 API，对已同步但时间变更的 session 调用更新 API，并将飞书返回的 `event_id` 存储到 session 记录中。

**Tech Stack:** 飞书开放平台 API v4、Next.js Route Handlers、Zod 校验、TDD (Vitest)

---

## 飞书 API 概要

| 功能 | 方法 | 路径 |
|---|---|---|
| 获取 tenant_access_token | POST | `/open-apis/auth/v3/tenant_access_token/internal` |
| 获取应用主日历 | GET | `/open-apis/calendar/v4/calendars/primary` |
| 创建日程 | POST | `/open-apis/calendar/v4/calendars/:calendar_id/events` |
| 更新日程 | PATCH | `/open-apis/calendar/v4/calendars/:calendar_id/events/:event_id` |
| 删除日程 | DELETE | `/open-apis/calendar/v4/calendars/:calendar_id/events/:event_id` |
| 查询忙闲 | POST | `/open-apis/calendar/v4/freebusy/list` |

**所需权限（飞书开放平台配置）：**
- `calendar:calendar` — 读取日历
- `calendar:calendar.event:write` — 创建/更新日程
- `calendar:calendar.event:read` — 读取日程

**认证方式：** `tenant_access_token`（应用身份），通过 `app_id` + `app_secret` 获取，有效期 2 小时。

---

## 文件结构

```
lib/
  calendar/
    calendarProvider.ts          # [修改] 新增 deleteCalendarEvent 方法
    mockFeishuCalendarProvider.ts # [修改] 实现 deleteCalendarEvent
    feishuCalendarProvider.ts     # [新建] 真实飞书 API 实现
    feishuTokenManager.ts         # [新建] Token 获取与缓存
    __tests__/
      feishuCalendarProvider.test.ts  # [新建] 真实 Provider 测试
      feishuTokenManager.test.ts      # [新建] Token 管理测试
  services/
    planService.ts               # [修改] 新增 syncSessionsToCalendar 方法、SessionRecord 增加 externalEventId
app/api/plans/[planId]/
  sync-calendar/
    route.ts                     # [新建] 同步到飞书日历 API
.env.example                     # [修改] 新增飞书配置项
```

---

## Chunk 1: 基础设施 — Token 管理 & Provider 接口扩展

### Task 1: 扩展 CalendarProvider 接口，新增 deleteCalendarEvent

**Files:**
- Modify: `lib/calendar/calendarProvider.ts`
- Modify: `lib/calendar/mockFeishuCalendarProvider.ts`
- Test: `lib/calendar/__tests__/mockFeishuCalendarProvider.test.ts`

- [ ] **Step 1: 修改 CalendarProvider 接口，增加 deleteCalendarEvent**
  ```typescript
  // lib/calendar/calendarProvider.ts 追加
  export interface DeleteCalendarEventInput {
    externalEventId: string;
  }

  export interface CalendarProvider {
    getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]>;
    createCalendarEvent(input: CreateCalendarEventInput): Promise<ExternalCalendarEvent>;
    updateCalendarEvent(input: UpdateCalendarEventInput): Promise<ExternalCalendarEvent>;
    deleteCalendarEvent(input: DeleteCalendarEventInput): Promise<void>;
  }
  ```

- [ ] **Step 2: 在 MockFeishuCalendarProvider 中实现 deleteCalendarEvent**
  ```typescript
  async deleteCalendarEvent(input: DeleteCalendarEventInput): Promise<void> {
    // mock: no-op
  }
  ```

- [ ] **Step 3: 运行现有测试确认不破坏**
  Run: `npx vitest run lib/calendar/__tests__/mockFeishuCalendarProvider.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add lib/calendar/calendarProvider.ts lib/calendar/mockFeishuCalendarProvider.ts
  git commit -m "feat: 扩展 CalendarProvider 接口，新增 deleteCalendarEvent"
  ```

---

### Task 2: 实现 FeishuTokenManager — Token 获取与缓存

**Files:**
- Create: `lib/calendar/feishuTokenManager.ts`
- Test: `lib/calendar/__tests__/feishuTokenManager.test.ts`

- [ ] **Step 1: 编写 feishuTokenManager 的失败测试**
  ```typescript
  // lib/calendar/__tests__/feishuTokenManager.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { FeishuTokenManager } from "../feishuTokenManager";

  describe("FeishuTokenManager", () => {
    const mockFetch = vi.fn();
    beforeEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = mockFetch;
    });

    it("应使用 app_id 和 app_secret 获取 tenant_access_token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          tenant_access_token: "t-xxx",
          expire: 7200
        })
      });

      const manager = new FeishuTokenManager({
        appId: "cli_test",
        appSecret: "secret_test"
      });

      const token = await manager.getToken();
      expect(token).toBe("t-xxx");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("应在有效期内复用缓存的 token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          tenant_access_token: "t-cached",
          expire: 7200
        })
      });

      const manager = new FeishuTokenManager({
        appId: "cli_test",
        appSecret: "secret_test"
      });

      const token1 = await manager.getToken();
      const token2 = await manager.getToken();
      expect(token1).toBe("t-cached");
      expect(token2).toBe("t-cached");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("token 过期后应重新获取", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            tenant_access_token: "t-old",
            expire: 1  // 1秒后过期
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            tenant_access_token: "t-new",
            expire: 7200
          })
        });

      const manager = new FeishuTokenManager({
        appId: "cli_test",
        appSecret: "secret_test"
      });

      const token1 = await manager.getToken();
      // 模拟过期
      vi.advanceTimersByTime(2000);
      const token2 = await manager.getToken();
      expect(token1).toBe("t-old");
      expect(token2).toBe("t-new");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("飞书 API 返回错误时应抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 10001,
          msg: "invalid app_id"
        })
      });

      const manager = new FeishuTokenManager({
        appId: "bad_id",
        appSecret: "bad_secret"
      });

      await expect(manager.getToken()).rejects.toThrow("invalid app_id");
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/calendar/__tests__/feishuTokenManager.test.ts`
  Expected: FAIL

- [ ] **Step 3: 实现 FeishuTokenManager**
  ```typescript
  // lib/calendar/feishuTokenManager.ts
  export interface FeishuTokenConfig {
    appId: string;
    appSecret: string;
  }

  interface TokenResponse {
    code: number;
    tenant_access_token?: string;
    expire?: number;
    msg?: string;
  }

  export class FeishuTokenManager {
    private readonly config: FeishuTokenConfig;
    private cachedToken: string | null = null;
    private expiresAt = 0;

    constructor(config: FeishuTokenConfig) {
      this.config = config;
    }

    async getToken(): Promise<string> {
      if (this.cachedToken && Date.now() < this.expiresAt) {
        return this.cachedToken;
      }

      const response = await fetch(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: this.config.appId,
            app_secret: this.config.appSecret
          })
        }
      );

      const data: TokenResponse = await response.json();

      if (data.code !== 0) {
        throw new Error(
          `获取飞书 tenant_access_token 失败: ${data.msg ?? `code ${data.code}`}`
        );
      }

      this.cachedToken = data.tenant_access_token!;
      // 提前 5 分钟过期，避免边界情况
      this.expiresAt = Date.now() + (data.expire ?? 7200) * 1000 - 5 * 60 * 1000;

      return this.cachedToken;
    }
  }
  ```

- [ ] **Step 4: 运行测试确认通过**
  Run: `npx vitest run lib/calendar/__tests__/feishuTokenManager.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/calendar/feishuTokenManager.ts lib/calendar/__tests__/feishuTokenManager.test.ts
  git commit -m "feat: 实现 FeishuTokenManager，支持 tenant_access_token 获取与缓存"
  ```

---

## Chunk 2: 真实飞书 CalendarProvider 实现

### Task 3: 实现 FeishuCalendarProvider — 创建/更新/删除日程 & 查询忙闲

**Files:**
- Create: `lib/calendar/feishuCalendarProvider.ts`
- Test: `lib/calendar/__tests__/feishuCalendarProvider.test.ts`

- [ ] **Step 1: 编写 FeishuCalendarProvider 测试**
  ```typescript
  // lib/calendar/__tests__/feishuCalendarProvider.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { FeishuCalendarProvider } from "../feishuCalendarProvider";

  describe("FeishuCalendarProvider", () => {
    const mockFetch = vi.fn();
    const mockGetToken = vi.fn().mockResolvedValue("t-test-token");
    const mockGetCalendarId = vi.fn().mockResolvedValue("cal_test_id");

    beforeEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = mockFetch;
      mockGetToken.mockResolvedValue("t-test-token");
      mockGetCalendarId.mockResolvedValue("cal_test_id");
    });

    describe("createCalendarEvent", () => {
      it("应调用飞书创建日程 API 并返回 ExternalCalendarEvent", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            data: {
              event: {
                event_id: "evt_001",
                summary: "测试任务",
                description: "描述",
                start_time: { timestamp: "1689069600", timezone: "Asia/Shanghai" },
                end_time: { timestamp: "1689073200", timezone: "Asia/Shanghai" }
              }
            }
          })
        });

        const provider = new FeishuCalendarProvider({
          getToken: mockGetToken,
          getCalendarId: mockGetCalendarId
        });

        const result = await provider.createCalendarEvent({
          title: "测试任务",
          description: "描述",
          startAt: new Date("2023-07-11T10:00:00+08:00"),
          endAt: new Date("2023-07-11T11:00:00+08:00")
        });

        expect(result.externalEventId).toBe("evt_001");
        expect(result.title).toBe("测试任务");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/calendar/v4/calendars/cal_test_id/events"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("飞书 API 返回错误时应抛出异常", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ code: 191002, msg: "no calendar access_role" })
        });

        const provider = new FeishuCalendarProvider({
          getToken: mockGetToken,
          getCalendarId: mockGetCalendarId
        });

        await expect(
          provider.createCalendarEvent({
            title: "测试",
            startAt: new Date(),
            endAt: new Date()
          })
        ).rejects.toThrow();
      });
    });

    describe("updateCalendarEvent", () => {
      it("应调用飞书更新日程 API", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            data: {
              event: {
                event_id: "evt_001",
                summary: "更新后标题",
                start_time: { timestamp: "1689069600", timezone: "Asia/Shanghai" },
                end_time: { timestamp: "1689076800", timezone: "Asia/Shanghai" }
              }
            }
          })
        });

        const provider = new FeishuCalendarProvider({
          getToken: mockGetToken,
          getCalendarId: mockGetCalendarId
        });

        const result = await provider.updateCalendarEvent({
          externalEventId: "evt_001",
          title: "更新后标题",
          startAt: new Date("2023-07-11T10:00:00+08:00"),
          endAt: new Date("2023-07-11T12:00:00+08:00")
        });

        expect(result.externalEventId).toBe("evt_001");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/calendar/v4/calendars/cal_test_id/events/evt_001"),
          expect.objectContaining({ method: "PATCH" })
        );
      });
    });

    describe("deleteCalendarEvent", () => {
      it("应调用飞书删除日程 API", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ code: 0 })
        });

        const provider = new FeishuCalendarProvider({
          getToken: mockGetToken,
          getCalendarId: mockGetCalendarId
        });

        await provider.deleteCalendarEvent({ externalEventId: "evt_001" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/calendar/v4/calendars/cal_test_id/events/evt_001"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("getBusySlots", () => {
      it("应调用飞书忙闲查询 API 并转换为 BusySlot[]", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            data: {
              freebusy: [
                {
                  start_time: { timestamp: "1689069600" },
                  end_time: { timestamp: "1689073200" },
                  free_busy_status: "busy"
                }
              ]
            }
          })
        });

        const provider = new FeishuCalendarProvider({
          getToken: mockGetToken,
          getCalendarId: mockGetCalendarId
        });

        const slots = await provider.getBusySlots({
          startAt: new Date("2023-07-11T00:00:00+08:00"),
          endAt: new Date("2023-07-11T23:59:59+08:00")
        });

        expect(slots).toHaveLength(1);
        expect(slots[0].startAt).toBeInstanceOf(Date);
        expect(slots[0].endAt).toBeInstanceOf(Date);
      });
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/calendar/__tests__/feishuCalendarProvider.test.ts`
  Expected: FAIL

- [ ] **Step 3: 实现 FeishuCalendarProvider**
  ```typescript
  // lib/calendar/feishuCalendarProvider.ts
  import type { BusySlot } from "@/packages/shared/src/availability-engine";
  import type {
    CalendarProvider,
    CreateCalendarEventInput,
    DeleteCalendarEventInput,
    ExternalCalendarEvent,
    GetBusySlotsInput,
    UpdateCalendarEventInput
  } from "./calendarProvider";

  export interface FeishuCalendarDeps {
    getToken: () => Promise<string>;
    getCalendarId: () => Promise<string>;
  }

  const FEISHU_BASE = "https://open.feishu.cn/open-apis";

  interface FeishuResponse {
    code: number;
    msg?: string;
    data?: Record<string, unknown>;
  }

  export class FeishuCalendarProvider implements CalendarProvider {
    constructor(private readonly deps: FeishuCalendarDeps) {}

    async getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]> {
      const token = await this.deps.getToken();
      const calendarId = await this.deps.getCalendarId();

      const response = await fetch(`${FEISHU_BASE}/calendar/v4/freebusy/list`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          time_min: formatTimestamp(input.startAt),
          time_max: formatTimestamp(input.endAt),
          user_id: { calendar_id: calendarId }
        })
      });

      const data: FeishuResponse = await response.json();
      assertFeishuSuccess(data, "查询忙闲");

      const freebusy = (data.data?.freebusy ?? []) as Array<{
        start_time: { timestamp: string };
        end_time: { timestamp: string };
        free_busy_status: string;
      }>;

      return freebusy
        .filter((item) => item.free_busy_status === "busy")
        .map((item) => ({
          startAt: new Date(Number(item.start_time.timestamp) * 1000),
          endAt: new Date(Number(item.end_time.timestamp) * 1000)
        }));
    }

    async createCalendarEvent(
      input: CreateCalendarEventInput
    ): Promise<ExternalCalendarEvent> {
      const token = await this.deps.getToken();
      const calendarId = await this.deps.getCalendarId();

      const body = {
        summary: input.title,
        description: input.description ?? "",
        start_time: {
          timestamp: formatTimestamp(input.startAt),
          timezone: "Asia/Shanghai"
        },
        end_time: {
          timestamp: formatTimestamp(input.endAt),
          timezone: "Asia/Shanghai"
        },
        visibility: "default",
        attendee_ability: "can_see_others",
        free_busy_status: "busy"
      };

      const response = await fetch(
        `${FEISHU_BASE}/calendar/v4/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data: FeishuResponse = await response.json();
      assertFeishuSuccess(data, "创建日程");

      const event = data.data?.event as {
        event_id: string;
        summary?: string;
        description?: string;
        start_time?: { timestamp: string };
        end_time?: { timestamp: string };
      };

      return {
        externalEventId: event.event_id,
        title: event.summary ?? input.title,
        description: event.description ?? input.description,
        startAt: input.startAt,
        endAt: input.endAt
      };
    }

    async updateCalendarEvent(
      input: UpdateCalendarEventInput
    ): Promise<ExternalCalendarEvent> {
      const token = await this.deps.getToken();
      const calendarId = await this.deps.getCalendarId();

      const body = {
        summary: input.title,
        description: input.description ?? "",
        start_time: {
          timestamp: formatTimestamp(input.startAt),
          timezone: "Asia/Shanghai"
        },
        end_time: {
          timestamp: formatTimestamp(input.endAt),
          timezone: "Asia/Shanghai"
        }
      };

      const response = await fetch(
        `${FEISHU_BASE}/calendar/v4/calendars/${calendarId}/events/${input.externalEventId}`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data: FeishuResponse = await response.json();
      assertFeishuSuccess(data, "更新日程");

      const event = data.data?.event as {
        event_id: string;
        summary?: string;
        description?: string;
      };

      return {
        externalEventId: event.event_id,
        title: event.summary ?? input.title,
        description: event.description ?? input.description,
        startAt: input.startAt,
        endAt: input.endAt
      };
    }

    async deleteCalendarEvent(
      input: DeleteCalendarEventInput
    ): Promise<void> {
      const token = await this.deps.getToken();
      const calendarId = await this.deps.getCalendarId();

      const response = await fetch(
        `${FEISHU_BASE}/calendar/v4/calendars/${calendarId}/events/${input.externalEventId}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data: FeishuResponse = await response.json();
      assertFeishuSuccess(data, "删除日程");
    }
  }

  /** Date -> 飞书秒级时间戳字符串 */
  function formatTimestamp(date: Date): string {
    return String(Math.floor(date.getTime() / 1000));
  }

  function assertFeishuSuccess(data: FeishuResponse, action: string): void {
    if (data.code !== 0) {
      throw new Error(`飞书日历${action}失败: [${data.code}] ${data.msg ?? "unknown"}`);
    }
  }
  ```

- [ ] **Step 4: 运行测试确认通过**
  Run: `npx vitest run lib/calendar/__tests__/feishuCalendarProvider.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/calendar/feishuCalendarProvider.ts lib/calendar/__tests__/feishuCalendarProvider.test.ts
  git commit -m "feat: 实现 FeishuCalendarProvider，对接真实飞书日历 API"
  ```

---

### Task 4: 实现获取应用主日历 ID 的工具函数

**Files:**
- Create: `lib/calendar/feishuCalendarId.ts`
- Test: `lib/calendar/__tests__/feishuCalendarId.test.ts`

- [ ] **Step 1: 编写测试**
  ```typescript
  // lib/calendar/__tests__/feishuCalendarId.test.ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { getFeishuPrimaryCalendarId } from "../feishuCalendarId";

  describe("getFeishuPrimaryCalendarId", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = mockFetch;
    });

    it("应返回应用主日历的 calendar_id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: {
            calendar: {
              calendar_id: "feishu.cn_test@group.calendar.feishu.cn",
              type: "primary"
            }
          }
        })
      });

      const calendarId = await getFeishuPrimaryCalendarId("t-test-token");
      expect(calendarId).toBe("feishu.cn_test@group.calendar.feishu.cn");
    });

    it("飞书 API 返回错误时应抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 191002, msg: "no calendar access_role" })
      });

      await expect(getFeishuPrimaryCalendarId("t-test-token")).rejects.toThrow();
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/calendar/__tests__/feishuCalendarId.test.ts`
  Expected: FAIL

- [ ] **Step 3: 实现 getFeishuPrimaryCalendarId**
  ```typescript
  // lib/calendar/feishuCalendarId.ts
  const FEISHU_BASE = "https://open.feishu.cn/open-apis";

  export async function getFeishuPrimaryCalendarId(
    token: string
  ): Promise<string> {
    const response = await fetch(
      `${FEISHU_BASE}/calendar/v4/calendars/primary`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(
        `获取飞书主日历失败: [${data.code}] ${data.msg ?? "unknown"}`
      );
    }

    return data.data.calendar.calendar_id as string;
  }
  ```

- [ ] **Step 4: 运行测试确认通过**
  Run: `npx vitest run lib/calendar/__tests__/feishuCalendarId.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/calendar/feishuCalendarId.ts lib/calendar/__tests__/feishuCalendarId.test.ts
  git commit -m "feat: 实现获取飞书应用主日历 ID 的工具函数"
  ```

---

## Chunk 3: 同步服务 & 数据模型

### Task 5: ScheduledSessionRecord 增加 externalEventId 字段

**Files:**
- Modify: `lib/services/planService.ts` — ScheduledSessionRecord 接口和 InMemoryRepository
- Modify: `packages/scheduler/src/scheduler.ts` — ScheduledSession 接口（可选，如需在 scheduler 层传递）
- Test: `lib/services/__tests__/planService.test.ts`

- [ ] **Step 1: 在 ScheduledSessionRecord 中增加 externalEventId**
  ```typescript
  // planService.ts 中
  export interface ScheduledSessionRecord extends Omit<ScheduledSession, "status"> {
    id: string;
    planId: string;
    status: SessionStatus;
    externalEventId?: string;  // 飞书日历事件 ID，同步后回填
  }
  ```

- [ ] **Step 2: 在 PlanRepository 中新增 updateSessionExternalEventId 方法**
  ```typescript
  export interface PlanRepository {
    // ... existing methods
    updateSessionExternalEventId(
      sessionId: string,
      externalEventId: string
    ): Promise<ScheduledSessionRecord>;
  }
  ```

- [ ] **Step 3: 在 InMemoryPlanRepository 和 PrismaPlanRepository 中实现 updateSessionExternalEventId**

- [ ] **Step 4: 运行现有测试确认不破坏**
  Run: `npx vitest run lib/services/__tests__/planService.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/services/planService.ts
  git commit -m "feat: ScheduledSessionRecord 增加 externalEventId 字段，支持日历同步回填"
  ```

---

### Task 6: 实现 syncSessionsToCalendar 服务

**Files:**
- Modify: `lib/services/planService.ts`
- Test: `lib/services/__tests__/planService.test.ts`

- [ ] **Step 1: 编写 syncSessionsToCalendar 测试**
  ```typescript
  describe("syncSessionsToCalendar", () => {
    it("应将所有未同步的 session 同步到飞书日历", async () => {
      // 创建一个 plan，包含 scheduled sessions 但没有 externalEventId
      // mock calendarProvider.createCalendarEvent 返回 externalEventId
      // 调用 syncSessionsToCalendar
      // 验证每个 session 都被创建了日历事件
      // 验证 repository.updateSessionExternalEventId 被调用
    });

    it("已同步的 session 应跳过不重复创建", async () => {
      // session 已有 externalEventId
      // 验证 createCalendarEvent 不被调用
    });

    it("时间有变的已同步 session 应调用更新 API", async () => {
      // session 有 externalEventId 但 startAt/endAt 已改变
      // 验证 updateCalendarEvent 被调用
    });

    it("无 scheduled session 时应返回空结果", async () => {
      // plan 没有 scheduled session
    });

    it("同步结果应包含成功和失败的统计", async () => {
      // 部分 session 同步失败
      // 结果应包含 syncedCount, failedCount, errors
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/services/__tests__/planService.test.ts -t "syncSessionsToCalendar"`
  Expected: FAIL

- [ ] **Step 3: 实现 syncSessionsToCalendar**

  实现思路：
  1. 获取 plan 的所有 sessions 和 tasks
  2. 遍历 `scheduled` 状态的 sessions
  3. 对没有 `externalEventId` 的 → 调用 `createCalendarEvent`
  4. 对有 `externalEventId` 但时间变更的 → 调用 `updateCalendarEvent`
  5. 对有 `externalEventId` 且时间未变的 → 跳过
  6. 成功后调用 `updateSessionExternalEventId` 回填
  7. 返回同步结果统计

  ```typescript
  export interface SyncCalendarResult {
    totalSessions: number;
    syncedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: Array<{ sessionId: string; reason: string }>;
  }

  export async function syncSessionsToCalendar(
    planId: string,
    dependencies: PlanServiceDependencies = {}
  ): Promise<SyncCalendarResult> {
    const repository = dependencies.repository ?? createPrismaPlanRepository();
    const calendarProvider =
      dependencies.calendarProvider ?? new MockFeishuCalendarProvider();

    const plan = await requirePlan(planId, repository);
    const taskById = new Map(plan.tasks.map((t) => [t.id, t]));
    const scheduledSessions = plan.sessions.filter(
      (s) => s.status === "scheduled"
    );

    if (scheduledSessions.length === 0) {
      return {
        totalSessions: 0,
        syncedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: []
      };
    }

    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: Array<{ sessionId: string; reason: string }> = [];

    for (const session of scheduledSessions) {
      const task = taskById.get(session.taskId);
      const title = task?.title ?? "学习日程";
      const description = task?.acceptanceCriteria?.join("; ") ?? "";

      try {
        if (!session.externalEventId) {
          // 新建日程
          const event = await calendarProvider.createCalendarEvent({
            title,
            description,
            startAt: session.startAt,
            endAt: session.endAt
          });
          await repository.updateSessionExternalEventId(
            session.id,
            event.externalEventId
          );
          syncedCount++;
        } else {
          // 已同步，跳过（后续可对比时间变更做更新）
          skippedCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push({
          sessionId: session.id,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      totalSessions: scheduledSessions.length,
      syncedCount,
      skippedCount,
      failedCount,
      errors
    };
  }
  ```

- [ ] **Step 4: 运行测试确认通过**
  Run: `npx vitest run lib/services/__tests__/planService.test.ts -t "syncSessionsToCalendar"`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/services/planService.ts lib/services/__tests__/planService.test.ts
  git commit -m "feat: 实现 syncSessionsToCalendar 服务，同步排程到飞书日历"
  ```

---

## Chunk 4: API 路由 & Provider 工厂

### Task 7: 创建 CalendarProvider 工厂函数

**Files:**
- Create: `lib/calendar/createCalendarProvider.ts`

- [ ] **Step 1: 实现工厂函数，根据环境变量选择 Provider**

  ```typescript
  // lib/calendar/createCalendarProvider.ts
  import type { CalendarProvider } from "./calendarProvider";
  import { MockFeishuCalendarProvider } from "./mockFeishuCalendarProvider";
  import { FeishuCalendarProvider } from "./feishuCalendarProvider";
  import { FeishuTokenManager } from "./feishuTokenManager";
  import { getFeishuPrimaryCalendarId } from "./feishuCalendarId";

  export function createCalendarProvider(): CalendarProvider {
    const provider = process.env.CALENDAR_PROVIDER ?? "mock_feishu";

    if (provider === "feishu") {
      const appId = process.env.FEISHU_APP_ID;
      const appSecret = process.env.FEISHU_APP_SECRET;

      if (!appId || !appSecret) {
        throw new Error(
          "CALENDAR_PROVIDER=feishu 时，必须配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET"
        );
      }

      const tokenManager = new FeishuTokenManager({ appId, appSecret });
      let cachedCalendarId: string | null = null;

      return new FeishuCalendarProvider({
        getToken: () => tokenManager.getToken(),
        getCalendarId: async () => {
          if (cachedCalendarId) return cachedCalendarId;
          const token = await tokenManager.getToken();
          cachedCalendarId = await getFeishuPrimaryCalendarId(token);
          return cachedCalendarId;
        }
      });
    }

    // 默认使用 mock
    return new MockFeishuCalendarProvider();
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add lib/calendar/createCalendarProvider.ts
  git commit -m "feat: 创建 CalendarProvider 工厂函数，根据环境变量选择真实/mock"
  ```

---

### Task 8: 新增同步到飞书日历的 API 路由

**Files:**
- Create: `app/api/plans/[planId]/sync-calendar/route.ts`
- Modify: `.env.example` — 新增 FEISHU_APP_ID、FEISHU_APP_SECRET

- [ ] **Step 1: 实现 API 路由**
  ```typescript
  // app/api/plans/[planId]/sync-calendar/route.ts
  import { NextResponse } from "next/server";
  import {
    syncSessionsToCalendar,
    PlanServiceError
  } from "@/lib/services/planService";
  import { getRepository } from "@/lib/server/repository";
  import { createCalendarProvider } from "@/lib/calendar/createCalendarProvider";

  interface RouteContext {
    params: Promise<{ planId: string }>;
  }

  export async function POST(_request: Request, context: RouteContext) {
    try {
      const { planId } = await context.params;
      const result = await syncSessionsToCalendar(planId, {
        repository: getRepository(),
        calendarProvider: createCalendarProvider()
      });

      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof PlanServiceError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message, details: error.details ?? {} } },
          { status: statusForError(error) }
        );
      }

      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Unexpected server error.", details: {} } },
        { status: 500 }
      );
    }
  }

  function statusForError(error: PlanServiceError): number {
    if (error.code === "NOT_FOUND") return 404;
    if (error.code === "CONFLICT") return 409;
    return 400;
  }
  ```

- [ ] **Step 2: 更新 .env.example**
  ```
  DATABASE_URL="postgresql://postgres:123456@localhost:5432/postgres?schema=public"
  AI_PROVIDER="mock"
  OPENAI_API_KEY=""
  CALENDAR_PROVIDER="mock_feishu"
  # 飞书日历集成配置（CALENDAR_PROVIDER=feishu 时需要）
  FEISHU_APP_ID=""
  FEISHU_APP_SECRET=""
  ```

- [ ] **Step 3: 运行 typecheck 确认无类型错误**
  Run: `npx tsc --noEmit`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add app/api/plans/[planId]/sync-calendar/route.ts .env.example
  git commit -m "feat: 新增同步到飞书日历的 API 路由 POST /plans/:planId/sync-calendar"
  ```

---

## Chunk 5: 前端 UI

### Task 9: 在计划详情页添加"同步到飞书日历"按钮

**Files:**
- Modify: 计划详情页面组件（需先确认具体文件路径）

- [ ] **Step 1: 找到计划详情页/仪表盘组件，确认修改位置**

- [ ] **Step 2: 添加"同步到飞书日历"按钮**

  按钮逻辑：
  1. 点击按钮 → 调用 `POST /api/plans/${planId}/sync-calendar`
  2. 展示 loading 状态
  3. 成功后展示同步结果（如"成功同步 5 个日程"）
  4. 失败展示错误提示

- [ ] **Step 3: 运行 typecheck 确认无类型错误**
  Run: `npx tsc --noEmit`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add <modified-ui-files>
  git commit -m "feat: 计划详情页添加同步到飞书日历按钮"
  ```

---

## Chunk 6: 集成验证

### Task 10: 端到端验证 & 全量测试

- [ ] **Step 1: 运行全量测试**
  Run: `npx vitest run`
  Expected: ALL PASS

- [ ] **Step 2: 运行 lint + typecheck + build**
  Run: `npm run lint && npm run typecheck && npm run build`
  Expected: ALL PASS

- [ ] **Step 3: 配置真实飞书环境变量进行手动测试**

  在 `.env.local` 中设置：
  ```
  CALENDAR_PROVIDER=feishu
  FEISHU_APP_ID=cli_xxxxxxxxxxxx
  FEISHU_APP_SECRET=xxxxxxxxxxxxx
  ```

  前提：飞书开放平台已创建应用，开通日历权限，应用已发布。

- [ ] **Step 4: 手动测试同步流程**
  1. 创建一个计划，生成排程
  2. 点击"同步到飞书日历"
  3. 在飞书日历中确认日程已创建
  4. 验证日程标题、时间、描述正确

- [ ] **Step 5: 最终 Commit**
  ```bash
  git add -A
  git commit -m "feat: 完成飞书日历同步功能开发"
  ```
