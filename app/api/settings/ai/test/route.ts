import { NextResponse } from "next/server";

// POST /api/settings/ai/test — 测试 AI API 连接是否成功
// 前端将完整配置（含 apiKey）从 localStorage 传过来，服务端只做验证请求。

interface TestRequestBody {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as TestRequestBody;

  const baseUrl = body.baseUrl ?? "";
  const model = body.model ?? "";
  const apiKey = body.apiKey ?? "";

  if (body.provider === "mock") {
    return NextResponse.json({
      success: true,
      message: "Mock 模式无需连接测试",
      latencyMs: 0
    });
  }

  if (!baseUrl || !model || !apiKey) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "baseUrl、model 和 apiKey 不能为空。" } },
      { status: 400 }
    );
  }

  try {
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
