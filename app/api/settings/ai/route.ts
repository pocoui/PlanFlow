import { NextResponse } from "next/server";

// GET /api/settings/ai — 兼容性保留，返回空配置提示
// AI 配置已迁移到前端 localStorage，前端不再调用此接口。
export async function GET() {
  return NextResponse.json({
    provider: "mock",
    openai: {
      baseUrl: "",
      model: "",
      apiKeyConfigured: false,
      apiKeyPreview: ""
    }
  });
}
