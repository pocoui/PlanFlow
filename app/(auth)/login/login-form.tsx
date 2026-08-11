"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

/**
 * 登录表单（客户端组件）。
 * - signIn("credentials", { redirect: false }) 手写跳转，失败显示统一提示
 * - 已登录访问 /login 的自动跳转由服务端 page.tsx 处理
 * - 请求进行中禁用重复提交
 */
export function LoginForm({ redirect }: { redirect: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      // 统一文案防枚举
      setError("邮箱或密码错误");
      setSubmitting(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">登录 PlanFlow</h1>
        <p className="mt-1 text-sm text-slate-500">使用邮箱与密码登录你的学习空间</p>
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
          autoComplete="current-password"
          className="input mt-1"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />
      </label>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        登录
      </button>

      <p className="text-center text-sm text-slate-500">
        还没有账号？{" "}
        <Link className="font-medium text-primary hover:underline" href="/register">
          注册
        </Link>
      </p>
    </form>
  );
}
