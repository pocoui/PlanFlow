"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-red-100 bg-red-50 px-4 text-center">
      <AlertCircle className="h-10 w-10 text-red-600" />
      <p className="text-sm font-medium text-red-700">
        {message || "加载失败，请稍后重试。"}
      </p>
      {onRetry ? (
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
          type="button"
          onClick={onRetry}
        >
          <RotateCcw className="h-4 w-4" />
          重试
        </button>
      ) : null}
    </div>
  );
}
