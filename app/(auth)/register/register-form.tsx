"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { csrfFetch } from "@/lib/client/csrf-fetch";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * 注册表单（客户端组件）。
 * 提交流程：前端校验 → csrfFetch POST /api/auth/register（注册 API 保持 CSRF 防护）
 * → 201 后用同样凭据 signIn 自动登录 → 跳转首页；409 显示「该邮箱已注册」。
 */
export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) {
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      return;
    }

    if (password.length < 8) {
      setError("密码长度至少 8 位");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await csrfFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        let message = "注册失败，请稍后重试";
        try {
          const body = (await res.json()) as ApiErrorBody;
          if (res.status === 409) {
            message = "该邮箱已注册";
          } else if (body.error?.message) {
            message = body.error.message;
          }
        } catch {
          // 响应体非 JSON，用默认提示
        }
        setError(message);
        return;
      }

      // 注册成功 → 自动登录
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // 注册已成功但自动登录失败，引导用户手动登录
        router.push("/login");
        router.refresh();
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">注册 PlanFlow</h1>
        <p className="mt-1 text-sm text-slate-500">创建账号，开启你的学习计划</p>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        邮箱
        <input
          autoComplete="email"
          className="input mt-1"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        密码
        <input
          autoComplete="new-password"
          className="input mt-1"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 位"
          type="password"
          value={password}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        确认密码
        <input
          autoComplete="new-password"
          className="input mt-1"
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="再次输入密码"
          type="password"
          value={confirmPassword}
        />
      </label>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        注册
      </button>

      <p className="text-center text-sm text-slate-500">
        已有账号？{" "}
        <Link className="font-medium text-primary hover:underline" href="/login">
          登录
        </Link>
      </p>
    </form>
  );
}
