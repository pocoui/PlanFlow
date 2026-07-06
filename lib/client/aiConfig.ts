import type { OpenAiCompatibleConfig } from "@/lib/services/aiPlanningService";

// AI 配置的客户端存储，使用 localStorage 持久化。
// 与 Vue3 对比：相当于 Pinia plugin 的 localStorage 持久化，
// 但这里直接操作 localStorage，更轻量。

export interface AiProviderConfig {
  provider: "mock" | "openai_compatible";
  openai: OpenAiCompatibleConfig;
}

const STORAGE_KEY = "planflow_ai_config";

function getDefaultConfig(): AiProviderConfig {
  return {
    provider: "mock",
    openai: {
      baseUrl: "",
      model: "",
      apiKey: ""
    }
  };
}

export function getAiConfig(): AiProviderConfig {
  if (typeof window === "undefined") return getDefaultConfig();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConfig();

    const parsed = JSON.parse(raw) as Partial<AiProviderConfig>;
    return {
      provider: parsed.provider ?? "mock",
      openai: {
        baseUrl: parsed.openai?.baseUrl ?? "",
        model: parsed.openai?.model ?? "",
        apiKey: parsed.openai?.apiKey ?? ""
      }
    };
  } catch {
    return getDefaultConfig();
  }
}

export function saveAiConfig(config: AiProviderConfig): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
}

// 脱敏预览：只返回 key 前缀和后缀
export function getApiKeyPreview(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return apiKey ? "****" : "";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// ── AI 配置校验 ───────────────────────────────────────────────
// 两个不同用途的检查：
//   isApiConfigured()  → 页面加载横幅：检测是否配置了真实 API（mock 不算）
//   validateAiConfig() → 提交时硬校验：mock 模式允许通过，openai_compatible 需三要素齐全

/**
 * 检查用户是否已配置了可用的真实 AI 接口。
 * 只有 openai_compatible 且 baseUrl / model / apiKey 三项均非空才算已配置。
 * mock 模式、从未保存过配置、字段缺失均视为未配置。
 */
export function isApiConfigured(): boolean {
  const config = getAiConfig();
  if (config.provider !== "openai_compatible") return false;
  return (
    config.openai.baseUrl.trim().length > 0 &&
    config.openai.model.trim().length > 0 &&
    config.openai.apiKey.trim().length > 0
  );
}

export interface AiConfigValidationResult {
  valid: boolean;
  /** human-readable reason; null when valid */
  reason: string | null;
}

export function validateAiConfig(
  config: AiProviderConfig
): AiConfigValidationResult {
  if (config.provider === "mock") {
    return { valid: true, reason: null };
  }

  const missing: string[] = [];
  if (!config.openai.baseUrl.trim()) missing.push("Base URL");
  if (!config.openai.model.trim()) missing.push("Model");
  if (!config.openai.apiKey.trim()) missing.push("API Key");

  if (missing.length > 0) {
    return {
      valid: false,
      reason: `AI 配置不完整，缺少：${missing.join("、")}。当前将使用模拟数据生成计划，如需真正的 AI 智能排程，请前往设置页面配置。`
    };
  }

  return { valid: true, reason: null };
}

/** Convenience: validate the config currently stored in localStorage. */
export function validateCurrentAiConfig(): AiConfigValidationResult {
  return validateAiConfig(getAiConfig());
}
