import type { OpenAiCompatibleConfig } from "@/lib/services/aiPlanningService";

// AI 配置的服务端环境变量兜底。
// 主配置已迁移到前端 localStorage（lib/client/aiConfig.ts），
// 这里仅提供 env 变量作为服务端 fallback。

export interface AiProviderConfig {
  provider: "mock" | "openai_compatible";
  openai: OpenAiCompatibleConfig;
}

/** 从环境变量读取 AI 配置，作为服务端 fallback */
export function getAiConfigFromEnv(): AiProviderConfig {
  return {
    provider: (process.env.AI_PROVIDER as AiProviderConfig["provider"]) ?? "mock",
    openai: {
      baseUrl: process.env.OPENAI_BASE_URL ?? "",
      model: process.env.OPENAI_MODEL ?? "",
      apiKey: process.env.OPENAI_API_KEY ?? ""
    }
  };
}
