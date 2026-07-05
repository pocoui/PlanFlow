import { NextResponse } from "next/server";

import { getAiConfig, updateAiConfig } from "@/lib/server/aiConfig";

// GET /api/settings/ai — 获取当前 AI 配置（apiKey 做脱敏处理）
export async function GET() {
  const config = getAiConfig();

  return NextResponse.json({
    provider: config.provider,
    openai: {
      baseUrl: config.openai.baseUrl,
      model: config.openai.model,
      // 脱敏：只返回 key 是否已配置，不返回完整值
      apiKeyConfigured: config.openai.apiKey.length > 0,
      apiKeyPreview: config.openai.apiKey.length > 0
        ? `${config.openai.apiKey.slice(0, 4)}...${config.openai.apiKey.slice(-4)}`
        : ""
    }
  });
}

// PUT /api/settings/ai — 更新 AI 配置
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: string;
      openai?: {
        baseUrl?: string;
        model?: string;
        apiKey?: string;
      };
    };

    const updated = updateAiConfig({
      provider: body.provider as "mock" | "openai_compatible" | undefined,
      openai: body.openai
        ? {
            baseUrl: body.openai.baseUrl ?? "",
            model: body.openai.model ?? "",
            apiKey: body.openai.apiKey ?? ""
          }
        : undefined
    });

    return NextResponse.json({
      provider: updated.provider,
      openai: {
        baseUrl: updated.openai.baseUrl,
        model: updated.openai.model,
        apiKeyConfigured: updated.openai.apiKey.length > 0,
        apiKeyPreview: updated.openai.apiKey.length > 0
          ? `${updated.openai.apiKey.slice(0, 4)}...${updated.openai.apiKey.slice(-4)}`
          : ""
      }
    });
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid request body." } },
      { status: 400 }
    );
  }
}
