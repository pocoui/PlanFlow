"use client";

import { CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// 设置页面——配置 AI Agent API。
// 与 Vue3 对比：useState 管理表单状态 ↔ ref/reactive，useEffect 加载初始数据 ↔ onMounted，
// useCallback 稳定回调引用 ↔ methods。

interface AiConfigDisplay {
  provider: "mock" | "openai_compatible";
  openai: {
    baseUrl: string;
    model: string;
    apiKeyConfigured: boolean;
    apiKeyPreview: string;
  };
}

interface FormState {
  provider: "mock" | "openai_compatible";
  baseUrl: string;
  model: string;
  apiKey: string;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/ai");
      const data = (await response.json()) as AiConfigDisplay;

      setForm({
        provider: data.provider,
        baseUrl: data.openai.baseUrl,
        model: data.openai.model,
        apiKey: ""
      });
      setApiKeyPreview(data.openai.apiKeyPreview);
    } catch {
      setMessage({ type: "error", text: "加载配置失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        provider: form.provider
      };

      if (form.provider === "openai_compatible") {
        payload.openai = {
          baseUrl: form.baseUrl,
          model: form.model,
          // 如果用户没有输入新的 apiKey，不覆盖已有配置
          ...(form.apiKey ? { apiKey: form.apiKey } : {})
        };
      }

      const response = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("保存失败");

      const data = (await response.json()) as AiConfigDisplay;

      setForm((prev) => ({
        ...prev,
        provider: data.provider,
        baseUrl: data.openai.baseUrl,
        model: data.openai.model,
        apiKey: ""
      }));
      setApiKeyPreview(data.openai.apiKeyPreview);

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

  function applyPreset(baseUrl: string, model: string) {
    setForm((prev) => ({ ...prev, baseUrl, model }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">AI 提供方</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded-lg border-2 p-4 text-left transition ${
                  form.provider === "mock"
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, provider: "mock" }))}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-slate-900">Mock 模式</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  使用内置示例任务，无需配置 API Key
                </p>
              </button>

              <button
                className={`rounded-lg border-2 p-4 text-left transition ${
                  form.provider === "openai_compatible"
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, provider: "openai_compatible" }))
                }
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-slate-900">OpenAI 兼容 API</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  支持 OpenAI、DeepSeek、Kimi、Ollama 等
                </p>
              </button>
            </div>
          </section>

          {/* OpenAI 兼容配置 */}
          {form.provider === "openai_compatible" ? (
            <section className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">API 配置</h2>

              {/* 预设快捷选择 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  快捷预设
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_MODELS.map((preset) => (
                    <button
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset.baseUrl, preset.model)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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
