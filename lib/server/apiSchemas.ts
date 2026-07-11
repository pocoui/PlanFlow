/**
 * API 请求体的 Zod 校验 Schema
 *
 * 作为 API route 层的第一道防线，在业务逻辑之前验证请求参数的合法性。
 * 设计决策：即使 planService 层已有 parseSessionStatus 等校验，
 * API 层仍应独立验证，避免攻击者绕过业务逻辑直接发送非法值。
 */

import { z } from "zod";

/**
 * PATCH /api/sessions/:sessionId/status
 */
export const updateSessionStatusSchema = z.object({
  status: z.enum(["scheduled", "completed", "missed", "rescheduled", "conflicted"], {
    message: "status 必须为 scheduled | completed | missed | rescheduled | conflicted 之一",
  }),
});

/**
 * PATCH /api/tasks/:taskId/status
 */
export const updateTaskStatusSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "delayed"], {
    message: "status 必须为 not_started | in_progress | completed | delayed 之一",
  }),
});

/**
 * POST /api/sessions/:sessionId/review
 */
export const submitSessionReviewSchema = z.object({
  result: z.enum(["completed", "partial", "not_completed", "skipped"], {
    message: "result 必须为 completed | partial | not_completed | skipped 之一",
  }),
  actualMinutes: z.number().int().min(0, "actualMinutes 必须 >= 0"),
  remainingMinutes: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional(),
  continueTask: z.boolean(),
});

/**
 * 通用校验辅助函数：解析请求体并校验，失败时返回标准错误响应
 */
export function validateRequestBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: Response } {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstError = result.error.issues[0];
  const message = firstError?.message ?? "请求参数校验失败";

  return {
    success: false,
    error: Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: {
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      },
      { status: 400 }
    ),
  };
}
