import { NextResponse } from "next/server";

import { getAiConfig } from "@/lib/server/aiConfig";
import { OpenAiCompatibleProvider } from "@/lib/services/aiPlanningService";

// POST /api/settings/ai/test — 测试 AI API 连接是否成功
// 发送一条简短消息，验证 API Key、Base URL、Model 是否有效。

interface TestRequestBody {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  useSavedKey?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json()) as TestRequestBody;

  // 如果前端传 useSavedKey，从服务端已保存配置中获取 apiKey
  let baseUrl = body.baseUrl ?? "";
  let model = body.model ?? "";
  let apiKey = body.apiKey ?? "";

  if (body.useSavedKey) {
    const saved = getAiConfig();
    baseUrl = baseUrl || saved.openai.baseUrl;
    model = model || saved.openai.model;
    apiKey = apiKey || saved.openai.apiKey;
  }

  if (!baseUrl || !model || !apiKey) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "baseUrl、model 和 apiKey 不能为空。" } },
      { status: 400 }
    );
  }

  try {
    // 发送一个简短请求，验证连接和 Key 是否有效
    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const startMs = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: "请回复「连接成功」四个字。" }
        ],
        max_tokens: 20,
        temperature: 0
      })
    });

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json({
        success: false,
        error: `API 返回 ${response.status}: ${errorBody.slice(0, 200)}`
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      success: true,
      message: content,
      latencyMs
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "连接失败"
    });
  }
}
