"use client";

export interface GreetingProps {
  userName?: string;
  todaySessionCount?: number;
}

export function Greeting({ userName, todaySessionCount }: GreetingProps) {
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "早上好"
      : hour >= 12 && hour < 18
        ? "下午好"
        : "晚上好";

  const today = new Date();
  const dateLabel = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-slate-900">
        {userName ? `${greeting}，${userName}` : `${greeting}，准备好学习了吗？`}
      </h1>
      <p className="text-sm text-slate-500">
        今天是 {dateLabel}，
        {typeof todaySessionCount === "number"
          ? `你有 ${todaySessionCount} 个学习日程`
          : "祝你学习愉快"}
      </p>
    </div>
  );
}
