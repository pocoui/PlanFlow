"use client";

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="h-4 w-64 rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-xl bg-slate-200" />
        <div className="h-32 rounded-xl bg-slate-200" />
        <div className="h-32 rounded-xl bg-slate-200" />
      </div>
      <div className="h-48 rounded-xl bg-slate-200" />
    </div>
  );
}
