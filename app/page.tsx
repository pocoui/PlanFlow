const workflowItems = [
  "创建学习目标",
  "配置每周可用时间",
  "读取模拟飞书忙闲",
  "生成学习日历",
  "复盘后顺延"
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-primary">PlanFlow AI</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            把学习目标排进真实可执行的日历时间
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            当前阶段只初始化 Next.js 全栈项目骨架。后续会在独立模块中接入
            AI 任务拆解、MockFeishu 忙闲、排程算法、复盘顺延和日历导出。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {workflowItems.map((item, index) => (
            <div
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              key={item}
            >
              <div className="text-sm font-semibold text-primary">
                0{index + 1}
              </div>
              <div className="mt-2 text-sm font-medium">{item}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
