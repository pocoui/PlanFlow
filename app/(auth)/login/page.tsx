import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

/** 仅允许站内相对路径，防开放重定向 */
function safeRedirect(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

// 服务端组件：经 searchParams prop 读取 redirect，客户端不调用 useSearchParams（无需 Suspense）。
// 已登录用户访问 /login 自动跳转到 redirect 或首页。
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectTo } = await searchParams;
  const session = await auth();

  if (session?.user) {
    redirect(safeRedirect(redirectTo));
  }

  return <LoginForm redirect={safeRedirect(redirectTo)} />;
}
