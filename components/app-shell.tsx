"use client";

import { AppSidebar } from "./app-sidebar";

// 带左侧导航的页面外壳，所有页面通过该壳保持导航一致。
// 与 Vue3 对比：相当于带 <router-view> 的布局组件。

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
