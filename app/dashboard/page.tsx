"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PlanDashboard } from "@/components/plan-dashboard";

function DashboardContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");

  if (!planId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-semibold text-slate-700">
            No plan selected
          </p>
          <p className="text-sm text-slate-500">
            Create a plan first, then view its dashboard.
          </p>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800"
            href="/"
          >
            Create a plan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <PlanDashboard planId={planId} />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
