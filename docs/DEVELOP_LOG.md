# DEVELOP_LOG

开发过程中遇到的问题与解决方案汇总。

---

## 1. 切换计划时对应任务没有重新加载

**日期:** 2026-07-06

**现象:** Dashboard 页面切换计划按钮后，`PlanDashboard` 组件显示的一直是第一个计划的数据，不会重新请求新计划。

**原因:** `components/plan-dashboard.tsx` 中 `useEffect` 的守卫条件过于严格：

```typescript
// 问题代码
useEffect(() => {
  if (viewState === "loading" && !plan) {
    void loadPlan();
  }
}, [viewState, plan, loadPlan]);
```

`loadPlan` 是 `useCallback([planId])`，`planId` 变化时会重建引用。但 effect 执行时 `viewState` 仍是上一次加载成功的 `"ready"`，`plan` 仍是旧数据（非 null），条件 `viewState === "loading" && !plan` 恒为 false，`loadPlan()` 永远不会被调用。

**解决方案:** 移除守卫条件，让 effect 在 `loadPlan` 引用变化时直接执行。`loadPlan` 内部第一行就是 `setViewState("loading")`，会重置状态后请求新数据。`loadPlan` 本身是 `useCallback([planId])`，只在 `planId` 变化时重建，不会造成无限循环。

```typescript
// 修复后
useEffect(() => {
  void loadPlan();
}, [loadPlan]);
```

**涉及文件:** `components/plan-dashboard.tsx`

---

## 2. vitest 中 aiConfig.ts 命名导出 resolve 失败

**日期:** 2026-07-06

**现象:** 在 `planCreation.test.ts` 中测试 `createAndGeneratePlan` 时，报错 `TypeError: validateAiConfig is not a function`。但同一个文件中的 `getAiConfig` 导出却正常工作。

**原因:** vitest SSR 模式对 `lib/client/aiConfig.ts` 的模块转换存在问题——`getAiConfig`（较早导出的函数）正常解析，而 `validateAiConfig`（文件末尾新增的导出函数）未被正确挂载到模块对象上。具体原因可能与 vitest 的 CJS/SSR 双通道编译缓存有关。

**解决方案:** 不跨文件导入 `validateAiConfig`，改为在 `planCreation.ts` 内部定义 `checkAiConfigValid()` 函数，直接内联校验逻辑。这样避免了跨模块的 SSR 导入问题。函数签名从 `validateAiConfig`（返回 `{ valid, reason }` 对象）改为 `checkAiConfigValid`（返回 `string | null`），API 更简洁。

**涉及文件:** `lib/client/planCreation.ts`

**经验:** 在 vitest 的 SSR + CJS 混合模式下，命名导出可能出现部分失效。当需要在测试中覆盖模块行为时，优先考虑将逻辑内联到消费方模块中，避免复杂的 `vi.mock` 配置。

---

## 3. vi.mock 提升（hoisting）导致其他测试被污染

**日期:** 2026-07-06

**现象:** 在 `planCreation.test.ts` 中用 `vi.mock("./aiConfig", ...)` mock `getAiConfig` 返回值后，同一个 describe 中所有测试的 `getAiConfig` 都被替换，导致依赖默认 mock 配置的原有测试全部失败。

**原因:** vitest 会将 `vi.mock()` 调用提升到文件顶部执行，mock 效果作用于整个文件，而非仅限于调用 `vi.mock` 的单个测试。此外，通过 `vi.mock` mock 整个模块后，再用 `vi.importActual` 获取真实导出时，由于提升顺序问题，被 mock 的函数可能仍未挂载。

**解决方案:** 
- 不在测试中 `vi.mock` 整个模块，改为导出纯函数 `checkAiConfigValid` 供单元测试直接调用
- 新增独立的 `describe("checkAiConfigValid")` 块，用不同的输入参数测试各种边界情况，完全不依赖 mock
- 原有的 `createAndGeneratePlan` 集成测试保持不变（测试环境中 `window` 为 undefined，`getAiConfig` 返回默认 mock 配置，默认通过校验）

**涉及文件:** `lib/client/planCreation.test.ts`

**经验:** `vi.mock` 是文件级别的全局替换，适合整个测试文件都需要同一种 mock 的场景。如果只有部分测试需要 mock，应该考虑：
1. 将差异化逻辑提炼为可独立测试的纯函数
2. 通过依赖注入（fether 参数）控制行为
3. 避免在同一文件中混合 mock 和非 mock 测试

---

## 4. AI 配置预检：默认 mock 导致横幅不显示

**日期:** 2026-07-06

**现象:** 实现了 AI 配置预检功能后，页面加载时横幅不显示。预期即使是默认 mock 模式也应该提示用户配置真实 API。

**原因:** 设计偏差——`validateAiConfig()` 对 `provider === "mock"` 返回 `{ valid: true }`，而 `getAiConfig()` 的默认值就是 mock。用户的真实 API 配置存在 localStorage 中，从未访问过设置页时 localStorage 为空 → 走默认 mock → 校验通过 → 不显示横幅。

**解决方案:** 拆分两种检查逻辑：

| 函数 | 用途 | mock 返回值 |
|------|------|------------|
| `isApiConfigured()` | 页面加载横幅：是否配了真实 API | `false`（mock 不算） |
| `validateAiConfig()` | 提交时硬校验：当前配置能否使用 | `{ valid: true }`（mock 可用） |

横幅使用 `isApiConfigured()` 判断：只有 `openai_compatible` 且三要素（baseUrl / model / apiKey）齐全才算已配置。提交硬校验保留 `validateAiConfig()`，mock 模式仍可正常创建计划。

```typescript
// 只有填了真实 API 才算已配置
export function isApiConfigured(): boolean {
  const config = getAiConfig();
  if (config.provider !== "openai_compatible") return false;
  return (
    config.openai.baseUrl.trim().length > 0 &&
    config.openai.model.trim().length > 0 &&
    config.openai.apiKey.trim().length > 0
  );
}
```

**涉及文件:** `lib/client/aiConfig.ts`、`components/plan-wizard.tsx`、`components/plan-creation-flow.tsx`

---

## 5. CSRF token 校验失败（POST /api/plans 返回 403）

**日期:** 2026-07-11

**现象:** 前端页面创建计划时，`POST /api/plans` 请求返回 `CSRF_TOKEN_MISMATCH` 错误。

**原因:** 存在两个独立的 `postJson` 函数，修复时只改了其中一个：
1. `lib/client/planCreation.ts` 中的 `postJson` — 已改为使用 `csrfFetch`（第一轮修复）
2. `components/wizard/wizard-utils.ts` 中的 `postJson` — 仍使用原生 `fetch`（遗漏）

`/plans/new` 页面使用的是 `PlanWizard` 组件，它调用的是 `wizard-utils.ts` 中的 `postJson`，所以第一轮修复未生效。服务端日志确认 `cookieToken` 存在但 `headerToken` 为 `MISSING`。

**解决方案:** 将 `wizard-utils.ts` 的 `postJson` 中的 `fetch` 替换为 `csrfFetch`，确保所有 mutating 请求都自动携带 `X-CSRF-Token` header。

**涉及文件:** `components/wizard/wizard-utils.ts`、`lib/client/planCreation.ts`

**经验:** 当项目中存在多个功能相似的辅助函数（如 `postJson`、`fetcher`）时，修复 bug 需要全局搜索所有调用点。使用 `Grep` 搜索模式名比只看导入更可靠。长期应统一为一个 `postJson` 实现，避免重复导致遗漏。

---

## 6. SSR/客户端水合不一致（Hydration Mismatch）

**日期:** 2026-07-11

**现象:** 访问 `/plans/new` 页面时控制台报 React Hydration 错误：服务端渲染的 `className` 与客户端不一致。具体表现为服务端渲染了 AI 配置警告（amber 样式），客户端渲染的是步骤内容（白色卡片）。

**原因:** `PlanWizard` 组件中用 `useMemo` 计算 `aiConfigWarning`：

```typescript
// 问题代码
const aiConfigWarning = useMemo(() => {
  if (isApiConfigured()) return null;
  return "尚未配置 AI 接口...";
}, []);
```

`isApiConfigured()` 读取 `localStorage`，SSR 时 `typeof window === "undefined"` 始终返回 `false`（渲染警告），客户端水合后读取实际值可能返回 `true`（不渲染警告），DOM 结构不一致。

**解决方案:** 改用 `useState` + `useEffect`，初始值为 `null`（SSR 阶段不渲染警告），水合完成后再根据 `localStorage` 实际值设置：

```typescript
// 修复后
const [aiConfigWarning, setAiConfigWarning] = useState<string | null>(null);
useEffect(() => {
  if (isApiConfigured()) {
    setAiConfigWarning(null);
  } else {
    setAiConfigWarning("尚未配置 AI 接口...");
  }
}, []);
```

**涉及文件:** `components/plan-wizard.tsx`

**经验:** React SSR 水合要求服务端和客户端首次渲染的 DOM 完全一致。任何依赖浏览器 API（`localStorage`、`window`、`document.cookie`）的计算都不能在 `useMemo` / 组件顶层执行，必须放在 `useEffect` 中延迟到客户端执行。与 Vue3 对比：Vue3 的 SSR 也有同样约束，`onMounted` 之前的逻辑不应访问浏览器 API。
