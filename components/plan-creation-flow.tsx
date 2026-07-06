"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  createAndGeneratePlan,
  validatePlanCreationForm
} from "@/lib/client/planCreation";
import type {
  GeneratePlanResponse,
  PlanCreationFormState
} from "@/lib/client/planCreation";
import { isApiConfigured } from "@/lib/client/aiConfig";

const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
];

const mockBusySlots = [
  {
    id: "mock-feishu-weekly-standup",
    title: "Weekly standup",
    startAt: "2026-07-06T10:00:00.000Z",
    endAt: "2026-07-06T10:30:00.000Z"
  },
  {
    id: "mock-feishu-design-review",
    title: "Design review",
    startAt: "2026-07-08T14:00:00.000Z",
    endAt: "2026-07-08T15:00:00.000Z"
  }
];

const initialForm: PlanCreationFormState = {
  title: "Learn React",
  goal: "Understand components, hooks, routing, and build a small app.",
  totalMinutes: "1800",
  startDate: "2026-07-06",
  deadline: "2026-07-31",
  rescheduleBufferMinutes: "15",
  availability: [
    { weekday: 1, startTime: "20:00", endTime: "22:00" },
    { weekday: 6, startTime: "09:00", endTime: "12:00" }
  ]
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function PlanCreationFlow() {
  const [form, setForm] = useState<PlanCreationFormState>(initialForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [generation, setGeneration] = useState<GeneratePlanResponse | null>(
    null
  );
  const validation = validatePlanCreationForm(form);
  const visibleBusySlots = useMemo(() => filterBusySlots(form), [form]);

  // 分层引导 · 信息提示：检测是否配置了真实 API（mock 不算已配置）
  const aiConfigWarning = useMemo(() => {
    if (isApiConfigured()) return null;
    return "尚未配置 AI 接口，当前将使用模拟数据生成计划。如需真正的 AI 智能排程，请先配置 OpenAI 兼容接口。";
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValidation = validatePlanCreationForm(form);

    if (!nextValidation.valid) {
      setSubmitState("error");
      setMessage(Object.values(nextValidation.errors)[0] ?? "Check the form.");
      return;
    }

    setSubmitState("submitting");
    setMessage("Creating plan and generating schedule...");

    try {
      const result = await createAndGeneratePlan(form);
      setGeneration(result.generation);
      setSubmitState("success");
      setMessage(`Generated ${result.generation.sessions.length} sessions.`);
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-2 border-b border-border pb-5">
            <p className="text-sm font-semibold text-primary">PlanFlow AI</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                  Plan creation
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Turn a learning goal into scheduled sessions using weekly
                  availability, MockFeishu busy time, and a reschedule buffer.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarClock className="h-4 w-4 text-primary" />
                Phase 4 frontend MVP
              </div>
            </div>
          </header>

          {aiConfigWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">尚未配置 AI 接口</p>
                  <p className="mt-1">{aiConfigWarning}</p>
                  <Link
                    className="mt-2 inline-block font-semibold underline hover:text-amber-900"
                    href="/settings"
                  >
                    前往设置 →
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <section className="grid gap-4 border-b border-border pb-5 sm:grid-cols-2">
              <Field label="Plan title" error={validation.errors.title}>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </Field>
              <Field
                label="Total learning minutes"
                error={validation.errors.totalMinutes}
              >
                <input
                  className="input"
                  min="1"
                  type="number"
                  value={form.totalMinutes}
                  onChange={(event) =>
                    setForm({ ...form, totalMinutes: event.target.value })
                  }
                />
              </Field>
              <Field label="Start date" error={validation.errors.startDate}>
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                />
              </Field>
              <Field label="Deadline" error={validation.errors.deadline}>
                <input
                  className="input"
                  type="date"
                  value={form.deadline}
                  onChange={(event) =>
                    setForm({ ...form, deadline: event.target.value })
                  }
                />
              </Field>
              <Field
                label="Buffer after conflicts"
                error={validation.errors.rescheduleBufferMinutes}
              >
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    min="0"
                    type="number"
                    value={form.rescheduleBufferMinutes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        rescheduleBufferMinutes: event.target.value
                      })
                    }
                  />
                  <span className="text-sm text-slate-500">min</span>
                </div>
              </Field>
              <Field
                className="sm:col-span-2"
                label="Learning goal"
                error={validation.errors.goal}
              >
                <textarea
                  className="input min-h-28 resize-y"
                  value={form.goal}
                  onChange={(event) =>
                    setForm({ ...form, goal: event.target.value })
                  }
                />
              </Field>
            </section>

            <WeeklyAvailabilityEditor
              error={validation.errors.availability}
              form={form}
              setForm={setForm}
            />

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <StatusMessage state={submitState} message={message} />
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitState === "submitting"}
                type="submit"
              >
                {submitState === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create and generate
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-5">
          <PreviewPanel title="MockFeishu busy preview">
            {visibleBusySlots.length === 0 ? (
              <EmptyState text="No mock busy slots overlap this date range." />
            ) : (
              <div className="flex flex-col gap-3">
                {visibleBusySlots.map((slot) => (
                  <div
                    className="rounded-md border border-border bg-white p-3"
                    key={slot.id}
                  >
                    <div className="font-medium">{slot.title}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {formatDateTime(slot.startAt)} - {formatTime(slot.endAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PreviewPanel>

          <PreviewPanel title="Generated result">
            {!generation ? (
              <EmptyState text="Create a plan to see generated tasks, sessions, and warnings." />
            ) : (
              <div className="flex flex-col gap-4">
                <SummaryGrid generation={generation} />
                <ResultList generation={generation} />
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800"
                  href={`/dashboard?planId=${generation.planId}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open dashboard
                </a>
              </div>
            )}
          </PreviewPanel>
        </aside>
      </div>
    </main>
  );
}

function WeeklyAvailabilityEditor({
  error,
  form,
  setForm
}: {
  error?: string;
  form: PlanCreationFormState;
  setForm: (form: PlanCreationFormState) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekly availability</h2>
          <p className="text-sm text-slate-600">
            Add the time ranges where learning sessions may be scheduled.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary"
          type="button"
          onClick={() =>
            setForm({
              ...form,
              availability: [
                ...form.availability,
                { weekday: 1, startTime: "19:00", endTime: "20:00" }
              ]
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add range
        </button>
      </div>
      {error ? <InlineError message={error} /> : null}
      <div className="flex flex-col gap-2">
        {form.availability.map((rule, index) => (
          <div
            className="grid gap-2 rounded-md border border-border bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            key={`${rule.weekday}-${rule.startTime}-${rule.endTime}-${index}`}
          >
            <select
              aria-label="Weekday"
              className="input"
              value={rule.weekday}
              onChange={(event) =>
                updateAvailability(form, setForm, index, {
                  weekday: Number(event.target.value)
                })
              }
            >
              {weekdays.map((weekday) => (
                <option key={weekday.value} value={weekday.value}>
                  {weekday.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Start time"
              className="input"
              type="time"
              value={rule.startTime}
              onChange={(event) =>
                updateAvailability(form, setForm, index, {
                  startTime: event.target.value
                })
              }
            />
            <input
              aria-label="End time"
              className="input"
              type="time"
              value={rule.endTime}
              onChange={(event) =>
                updateAvailability(form, setForm, index, {
                  endTime: event.target.value
                })
              }
            />
            <button
              aria-label="Remove availability range"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-slate-600 transition hover:border-red-300 hover:text-red-700"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  availability: form.availability.filter(
                    (_item, itemIndex) => itemIndex !== index
                  )
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  children,
  className = "",
  error,
  label
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <InlineError message={error} /> : null}
    </label>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-700">
      <AlertCircle className="h-4 w-4" />
      {message}
    </span>
  );
}

function StatusMessage({
  message,
  state
}: {
  message: string;
  state: SubmitState;
}) {
  if (!message) {
    return <div className="text-sm text-slate-500">Ready to create a plan.</div>;
  }

  const color =
    state === "success"
      ? "text-emerald-700"
      : state === "error"
        ? "text-red-700"
        : "text-slate-600";
  const Icon = state === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`inline-flex items-center gap-2 text-sm ${color}`}>
      {state === "submitting" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {message}
    </div>
  );
}

function PreviewPanel({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-md border border-border bg-slate-50 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Clock className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-white p-4 text-sm text-slate-500">
      {text}
    </div>
  );
}

function SummaryGrid({ generation }: { generation: GeneratePlanResponse }) {
  const items = [
    { label: "Tasks", value: generation.tasks.length },
    { label: "Sessions", value: generation.sessions.length },
    { label: "Busy slots", value: generation.busySlots.length },
    { label: "Warnings", value: generation.warnings.length }
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div className="rounded-md border border-border bg-white p-3" key={item.label}>
          <div className="text-xs font-medium uppercase text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 text-2xl font-semibold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ResultList({ generation }: { generation: GeneratePlanResponse }) {
  return (
    <div className="flex flex-col gap-3">
      {generation.tasks.slice(0, 4).map((task) => (
        <div className="rounded-md border border-border bg-white p-3" key={task.id}>
          <div className="font-medium">{task.title}</div>
          <div className="mt-1 text-sm text-slate-600">
            {task.estimatedMinutes} min
            {task.phase ? ` - ${task.phase}` : ""}
          </div>
        </div>
      ))}
      {generation.warnings.map((warning) => (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          key={`${warning.code}-${warning.taskId ?? "plan"}`}
        >
          {warning.message}
        </div>
      ))}
    </div>
  );
}

function updateAvailability(
  form: PlanCreationFormState,
  setForm: (form: PlanCreationFormState) => void,
  index: number,
  patch: Partial<PlanCreationFormState["availability"][number]>
) {
  setForm({
    ...form,
    availability: form.availability.map((rule, itemIndex) =>
      itemIndex === index ? { ...rule, ...patch } : rule
    )
  });
}

function filterBusySlots(form: PlanCreationFormState) {
  const startAt = new Date(form.startDate).getTime();
  const endAt = new Date(form.deadline).getTime();

  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return [];
  }

  return mockBusySlots.filter((slot) => {
    const slotStart = new Date(slot.startAt).getTime();
    const slotEnd = new Date(slot.endAt).getTime();

    return slotStart < endAt && slotEnd > startAt;
  });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeStyle: "short"
  }).format(new Date(value));
}
