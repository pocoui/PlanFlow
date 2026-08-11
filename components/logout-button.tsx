"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * 退出登录按钮。signOut 清除会话后跳回 /login；
 * 已登出态再触发 signOut 不报错，直接落在登录页。
 */
export function LogoutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      aria-label="退出登录"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
      disabled={signingOut}
      onClick={handleLogout}
      title="退出登录"
      type="button"
    >
      {signingOut ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
    </button>
  );
}
