import type { OpenAiCompatibleConfig } from "@/lib/services/aiPlanningService";

// AI 配置存储，使用 globalThis 防止 HMR 重置。
// 与 Vue3 对比：相当于 Pinia store 的服务端版本，但只存内存不持久化。

export interface AiProviderConfig {
  provider: "mock" | "openai_compatible";
  openai: OpenAiCompatibleConfig;
}

const globalForConfig = globalThis as unknown as {
  __planflowAiConfig?: AiProviderConfig;
};

export function getAiConfig(): AiProviderConfig {
  if (!globalForConfig.__planflowAiConfig) {
    // 优先从环境变量读取默认配置
    globalForConfig.__planflowAiConfig = {
      provider: (process.env.AI_PROVIDER as AiProviderConfig["provider"]) ?? "mock",
      openai: {
        baseUrl: process.env.OPENAI_BASE_URL ?? "",
        model: process.env.OPENAI_MODEL ?? "",
        apiKey: process.env.OPENAI_API_KEY ?? ""
      }
    };
  }

  return globalForConfig.__planflowAiConfig;
}

export function updateAiConfig(patch: Partial<AiProviderConfig>): AiProviderConfig {
  const current = getAiConfig();

  const updated: AiProviderConfig = {
    provider: patch.provider ?? current.provider,
    openai: {
      baseUrl: patch.openai?.baseUrl ?? current.openai.baseUrl,
      model: patch.openai?.model ?? current.openai.model,
      apiKey: patch.openai?.apiKey ?? current.openai.apiKey
    }
  };

  globalForConfig.__planflowAiConfig = updated;

  return updated;
}
