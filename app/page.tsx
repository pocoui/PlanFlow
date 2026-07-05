"use client";

import { CalendarDays, Layers, Sparkles } from "lucide-react";
import Link from "next/link";

// 首页作为 PlanFlow AI 的总览入口，MVP 阶段展示核心功能入口。
// 与 Vue3 对比：Link 组件相当于 <router-link>。

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">PlanFlow AI</h1>
          <p className="mt-2 text-slate-600">AI 驱动的学习计划与日历排程助手</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary hover:shadow-md"
            href="/plans/new"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">创建学习计划</h2>
            <p className="mt-1 text-sm text-slate-600">
              输入学习目标，AI 自动生成个性化排程。
            </p>
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm opacity-70">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <CalendarDays className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">学习日历</h2>
            <p className="mt-1 text-sm text-slate-600">
              查看学习日程和进度（后续实现）。
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm opacity-70">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Layers className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">任务管理</h2>
            <p className="mt-1 text-sm text-slate-600">
              管理 AI 拆解的学习任务（后续实现）。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
