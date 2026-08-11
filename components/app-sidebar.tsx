"use client";

import {
  CalendarDays,
  Home,
  Settings,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { LogoutButton } from "./logout-button";

// 左侧导航栏，与原型图保持一致。
// MVP 阶段「计划」「日历」为主流程，其余入口为占位或后续实现。

// TODO: "任务""数据" tab 暂不实现，后续开发
const navItems = [
  { label: "首页", href: "/", icon: Home },
  { label: "计划", href: "/plans/new", icon: Sparkles },
  { label: "任务", href: "/dashboard", icon: CalendarDays },
  { label: "设置", href: "/settings", icon: Settings }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold text-slate-900">PlanFlow AI</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <Link
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  href={item.href}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium text-slate-800">
              {user?.name ?? "未登录"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {user?.email ?? "—"}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
