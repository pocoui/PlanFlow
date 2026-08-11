"use client";

import Link from "next/link";
import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 注册表单（客户端组件）。
 * Step 4：仅完成表单 UI 与前端校验（邮箱格式、密码 ≥8 位、两次一致），
 * 提交回调校验后占位不发请求——真实提交流程（csrfFetch → 注册 API → 自动登录 → 跳转）
 * 在 Step 5 接线。
 */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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

    // Step 5 接线真实提交流程；当前占位不发请求
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
        className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        type="submit"
      >
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
