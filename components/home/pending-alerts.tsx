"use client";

import { AlertCircle, Bell, ExternalLink, MessageSquareWarning, RefreshCw } from "lucide-react";
import Link from "next/link";

import type { HomeAlert } from "@/lib/client/home";

export interface PendingAlertsProps {
  alerts: HomeAlert[];
}

type AlertVariant = {
  icon: React.ElementType;
  border: string;
  bg: string;
  iconColor: string;
  titleColor: string;
  descColor: string;
  buttonClass: string;
};

const variants: Record<HomeAlert["type"], AlertVariant> = {
  review: {
    icon: MessageSquareWarning,
    border: "border-blue-200",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
    titleColor: "text-blue-900",
    descColor: "text-blue-700",
    buttonClass:
      "bg-white text-blue-700 hover:bg-blue-100"
  },
  feishu_auth: {
    icon: RefreshCw,
    border: "border-amber-200",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    descColor: "text-amber-700",
    buttonClass:
      "bg-white text-amber-700 hover:bg-amber-100"
  },
  conflict: {
    icon: AlertCircle,
    border: "border-red-200",
    bg: "bg-red-50",
    iconColor: "text-red-600",
    titleColor: "text-red-900",
    descColor: "text-red-700",
    buttonClass: "bg-white text-red-700 hover:bg-red-100"
  }
};

export function PendingAlerts({ alerts }: PendingAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="h-5 w-5 text-primary" />
        待处理提醒
      </h2>
      <div className="flex flex-col gap-2.5">
        {alerts.map((alert) => {
          const variant = variants[alert.type];
          const Icon = variant.icon;

          return (
            <div
              key={`${alert.type}-${alert.planId}-${alert.sessionId ?? ""}`}
              className={`flex flex-col gap-3 rounded-xl border ${variant.border} ${variant.bg} p-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${variant.iconColor}`} />
                <div>
                  <p className={`text-sm font-medium ${variant.titleColor}`}>
                    {alert.message}
                  </p>
                  {alert.type === "feishu_auth" ? (
                    <p className={`mt-1 text-xs ${variant.descColor}`}>
                      需要重新授权飞书账号
                    </p>
                  ) : null}
                </div>
              </div>

              <AlertAction alert={alert} variant={variant} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 校验 URL 协议，仅允许 https: 和 http:（防御 javascript: 等协议注入） */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function AlertAction({
  alert,
  variant
}: {
  alert: HomeAlert;
  variant: AlertVariant;
}) {
  const className = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm transition ${variant.buttonClass}`;

  if (alert.action.kind === "href" && alert.action.payload) {
    return (
      <Link className={className} href={alert.action.payload}>
        {alert.actionLabel}
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (alert.action.kind === "authorize" && alert.action.payload) {
    const handleAuthorize = () => {
      if (isSafeUrl(alert.action.payload!)) {
        window.location.href = alert.action.payload!;
      }
    };

    return (
      <button
        className={className}
        type="button"
        onClick={handleAuthorize}
      >
        {alert.actionLabel}
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    );
  }

  return null;
}
