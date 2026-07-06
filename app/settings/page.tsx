"use client";

import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getAiConfig,
  saveAiConfig,
  getApiKeyPreview
} from "@/lib/client/aiConfig";
import type { AiProviderConfig } from "@/lib/client/aiConfig";

// 设置页面——配置 AI Agent API，所有配置存储在 localStorage。
// 与 Vue3 对比：useState 管理表单状态 ↔ ref/reactive，useEffect 加载初始数据 ↔ onMounted，
// useCallback 稳定回调引用 ↔ methods。

interface FormState {
  provider: "mock" | "openai_compatible";
  baseUrl: string;
  model: string;
  apiKey: string;
}

interface TestResult {
  testing: boolean;
  success: boolean | null;
  message: string;
  latencyMs: number | null;
}

const PRESET_MODELS = [
  { label: "OpenAI (GPT-4o)", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "Kimi (月之暗面)", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { label: "Ollama (本地)", baseUrl: "http://localhost:11434/v1", model: "qwen2.5" }
];

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>({
    provider: "mock",
    baseUrl: "",
    model: "",
    apiKey: ""
  });
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<TestResult>({
    testing: false,
    success: null,
    message: "",
    latencyMs: null
  });

  // 从 localStorage 加载配置
  const loadConfig = useCallback(() => {
    const config = getAiConfig();
    setForm({
      provider: config.provider,
      baseUrl: config.openai.baseUrl,
      model: config.openai.model,
      apiKey: "" // 不回填 apiKey，只显示脱敏预览
    });
    setApiKeyPreview(config.openai.apiKey ? getApiKeyPreview(config.openai.apiKey) : "");
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const currentConfig = getAiConfig();
      const config: AiProviderConfig = {
        provider: form.provider,
        openai: {
          baseUrl: form.baseUrl,
          model: form.model,
          // 如果用户没有输入新的 apiKey，保留已有的
          apiKey: form.apiKey || currentConfig.openai.apiKey
        }
      };

      saveAiConfig(config);

      // 刷新表单状态
      loadConfig();
      setMessage({ type: "success", text: "AI 配置已保存" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败"
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult({ testing: true, success: null, message: "", latencyMs: null });

    try {
      // 先保存当前配置到 localStorage
      const currentConfig = getAiConfig();
      const config: AiProviderConfig = {
        provider: form.provider,
        openai: {
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: form.apiKey || currentConfig.openai.apiKey
        }
      };
      saveAiConfig(config);

      // 发送测试请求，直接将完整配置传给服务端
      const response = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          baseUrl: config.openai.baseUrl,
          model: config.openai.model,
          apiKey: config.openai.apiKey
        })
      });

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: string;
        latencyMs?: number;
      };

      if (result.success) {
        setTestResult({
          testing: false,
          success: true,
          message: result.message ?? "连接成功",
          latencyMs: result.latencyMs ?? null
        });
      } else {
        setTestResult({
          testing: false,
          success: false,
          message: result.error ?? "连接失败",
          latencyMs: null
        });
      }
    } catch (error) {
      setTestResult({
        testing: false,
        success: false,
        message: error instanceof Error ? error.message : "测试请求失败",
        latencyMs: null
      });
    }
  }

  function applyPreset(baseUrl: string, model: string) {
    setForm((prev) => ({ ...prev, baseUrl, model }));
  }

  // 当前可用于测试的 apiKey（表单新输入 > 已保存的）
  const effectiveApiKey = form.apiKey || getAiConfig().openai.apiKey;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">设置</h1>
          <p className="mt-1 text-sm text-slate-600">配置 AI Agent API，用于自动拆解学习任务。</p>
        </div>

        {message ? (
          <div
            className={`mb-5 rounded-lg border p-3 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mr-1 inline h-4 w-4" />
            ) : null}
            {message.text}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Provider 选择 */}
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">AI 提供方</h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                选择 AI 提供方
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.provider}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    provider: e.target.value as "mock" | "openai_compatible"
                  }))
                }
              >
                <option value="mock">Mock 模式（内置示例任务，无需 API Key）</option>
                <option value="openai_compatible">OpenAI 兼容 API（支持 OpenAI、DeepSeek、Kimi、Ollama 等）</option>
              </select>
            </div>
          </section>

          {/* OpenAI 兼容配置 */}
          {form.provider === "openai_compatible" ? (
            <section className="mt-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">API 配置</h2>

              {/* 预设下拉选择 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  快捷预设
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onChange={(e) => {
                    const preset = PRESET_MODELS.find((p) => p.label === e.target.value);
                    if (preset) applyPreset(preset.baseUrl, preset.model);
                  }}
                  value=""
                >
                  <option value="">选择预设...</option>
                  {PRESET_MODELS.map((preset) => (
                    <option key={preset.label} value={preset.label}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Base URL
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://api.openai.com/v1"
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                  }
                />
                <p className="mt-1 text-xs text-slate-500">
                  API 的基础地址，不含 /chat/completions 路径
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Model
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="gpt-4o"
                  value={form.model}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  API Key
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={apiKeyPreview || "sk-..."}
                  type="password"
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                />
                {apiKeyPreview ? (
                  <p className="mt-1 text-xs text-slate-500">
                    当前已配置：{apiKeyPreview}（留空则保持不变）
                  </p>
                ) : null}
              </div>

              {/* 测试连接 */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">连接测试</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      验证 API 配置是否正确，发送一条简短消息检查连通性
                    </p>
                  </div>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-60"
                    disabled={testResult.testing || !form.baseUrl || !form.model || !effectiveApiKey}
                    type="button"
                    onClick={() => handleTest()}
                  >
                    {testResult.testing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        测试中...
                      </>
                    ) : (
                      "测试连接"
                    )}
                  </button>
                </div>

                {testResult.success !== null ? (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      testResult.success
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="mr-1 inline h-4 w-4" />
                    ) : (
                      <AlertCircle className="mr-1 inline h-4 w-4" />
                    )}
                    {testResult.success
                      ? `连接成功${testResult.latencyMs ? `（耗时 ${testResult.latencyMs}ms）` : ""}：${testResult.message}`
                      : `连接失败：${testResult.message}`
                    }
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 保存按钮 */}
          <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
              disabled={saving}
              type="button"
              onClick={() => handleSave()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              保存配置
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
