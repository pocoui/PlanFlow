"use client";

import { AlertTriangle, X } from "lucide-react";

import type { DailyAvailability } from "./wizard-types";
import { Switch } from "./step-plan-info";
import { detectConflicts, type ExistingSession, type ConflictInfo } from "./wizard-utils";

export function StepAvailability({
  availability,
  onChange,
  existingSessions = []
}: {
  availability: DailyAvailability[];
  onChange: (availability: DailyAvailability[]) => void;
  existingSessions?: ExistingSession[];
}) {
  function toggleWeekday(weekday: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              enabled: !day.enabled,
              ranges: !day.enabled ? [{ startTime: "20:00", endTime: "22:00" }] : day.ranges
            }
          : day
      )
    );
  }

  function addRange(weekday: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: [...day.ranges, { startTime: "20:00", endTime: "22:00" }]
            }
          : day
      )
    );
  }

  function updateRange(
    weekday: number,
    rangeIndex: number,
    patch: Partial<{ startTime: string; endTime: string }>
  ) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: day.ranges.map((range, index) =>
                index === rangeIndex ? { ...range, ...patch } : range
              )
            }
          : day
      )
    );
  }

  function removeRange(weekday: number, rangeIndex: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? { ...day, ranges: day.ranges.filter((_, index) => index !== rangeIndex) }
          : day
      )
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        选择你每周可投入学习的时间段，AI 将在这些时间内安排学习任务。
      </div>

      <div className="flex flex-col gap-3">
        {availability.map((day) => (
          <div
            key={day.weekday}
            className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex w-24 shrink-0 items-center gap-3">
              <Switch
                checked={day.enabled}
                onChange={() => toggleWeekday(day.weekday)}
              />
              <span className="font-medium text-slate-700">{day.label}</span>
            </div>

            {day.enabled ? (
              <div className="flex flex-1 flex-col gap-2">
                {day.ranges.map((range, rangeIndex) => {
                  const conflicts = detectConflicts(
                    day.weekday,
                    range.startTime,
                    range.endTime,
                    existingSessions
                  );

                  return (
                    <div key={rangeIndex} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <input
                            className="w-32 rounded border border-slate-200 px-2 py-1 text-sm"
                            type="time"
                            value={range.startTime}
                            onChange={(e) =>
                              updateRange(day.weekday, rangeIndex, {
                                startTime: e.target.value
                              })
                            }
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            className="w-32 rounded border border-slate-200 px-2 py-1 text-sm"
                            type="time"
                            value={range.endTime}
                            onChange={(e) =>
                              updateRange(day.weekday, rangeIndex, {
                                endTime: e.target.value
                              })
                            }
                          />
                        </div>
                        {rangeIndex === 0 ? (
                          <button
                            className="small-action"
                            type="button"
                            onClick={() => addRange(day.weekday)}
                          >
                            + 添加时间
                          </button>
                        ) : (
                          <button
                            className="text-slate-400 hover:text-red-600"
                            type="button"
                            onClick={() => removeRange(day.weekday, rangeIndex)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {conflicts.length > 0 ? (
                        <ConflictWarnings conflicts={conflicts} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm text-slate-400">未设置</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ConflictWarnings({ conflicts }: { conflicts: ConflictInfo[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {conflicts.map((conflict, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>
            与计划「{conflict.planTitle}」{conflict.timeRange} 冲突
          </span>
        </div>
      ))}
    </div>
  );
}
