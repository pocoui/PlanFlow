const globalForAiTaskCounter = globalThis as unknown as {
  __planflowAiTaskCounter?: number;
};

let aiTaskCounter = globalForAiTaskCounter.__planflowAiTaskCounter ?? 0;

function nextAiTaskId(): string {
  aiTaskCounter += 1;
  globalForAiTaskCounter.__planflowAiTaskCounter = aiTaskCounter;
  return `task_${aiTaskCounter}`;
}

export interface GenerateLearningTasksInput {
  title: string;
  goal: string;
  totalMinutes: number;
}

export interface GeneratedLearningTask {
  id: string;
  phase: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: number;
  acceptanceCriteria: string[];
  orderIndex: number;
}

export interface AiPlanningProvider {
  generateLearningTasks(
    input: GenerateLearningTasksInput
  ): Promise<GeneratedLearningTask[]>;
}

export type GeneratedTaskValidationErrorCode =
  | "task.title.required"
  | "task.estimatedMinutes.positive"
  | "task.acceptanceCriteria.required";

export interface GeneratedTaskValidationError {
  code: GeneratedTaskValidationErrorCode;
  message: string;
  index: number;
  field: keyof GeneratedLearningTask;
}

export interface GeneratedTaskValidationWarning {
  code: "task.totalMinutes.deviation";
  message: string;
  targetTotalMinutes: number;
  generatedTotalMinutes: number;
}

export interface ValidateGeneratedTasksInput {
  targetTotalMinutes: number;
  tasks: GeneratedLearningTask[];
}

export interface ValidateGeneratedTasksResult {
  valid: boolean;
  errors: GeneratedTaskValidationError[];
  warnings: GeneratedTaskValidationWarning[];
}

const TOTAL_MINUTES_WARNING_RATIO = 0.1;

export interface GenerateLearningTasksResult {
  tasks: GeneratedLearningTask[];
  warnings: GeneratedTaskValidationWarning[];
}

export async function generateLearningTasks(
  input: GenerateLearningTasksInput,
  provider: AiPlanningProvider = new MockAiPlanningProvider()
): Promise<GenerateLearningTasksResult> {
  const activeProvider = provider;
  console.log("[aiPlanning.generateLearningTasks] 使用 Provider:", activeProvider.constructor.name, "输入 totalMinutes:", input.totalMinutes);
  const tasks = await activeProvider.generateLearningTasks(input);
  console.log("[aiPlanning.generateLearningTasks] Provider 返回 tasks:", tasks.length);
  const validation = validateGeneratedTasks({
    targetTotalMinutes: input.totalMinutes,
    tasks
  });

  if (!validation.valid) {
    console.error("[aiPlanning.generateLearningTasks] 校验失败");
    throw new Error("Generated learning tasks are invalid.");
  }

  console.log("[aiPlanning.generateLearningTasks] 校验通过 warnings:", validation.warnings.length);
  return {
    tasks,
    warnings: validation.warnings
  };
}

// 根据当前配置创建对应的 Provider 实例
export function createProviderFromConfig(config: {
  provider: "mock" | "openai_compatible";
  openai: OpenAiCompatibleConfig;
}): AiPlanningProvider {
  console.log("[aiPlanning.createProviderFromConfig] provider:", config.provider, "baseUrl:", config.openai.baseUrl || "(empty)", "apiKey:", config.openai.apiKey ? "***" : "(empty)");
  if (
    config.provider === "openai_compatible" &&
    config.openai.baseUrl &&
    config.openai.apiKey
  ) {
    console.log("[aiPlanning.createProviderFromConfig] → OpenAiCompatibleProvider");
    return new OpenAiCompatibleProvider(config.openai);
  }

  console.log("[aiPlanning.createProviderFromConfig] → MockAiPlanningProvider (fallback)");
  return new MockAiPlanningProvider();
}

export class MockAiPlanningProvider implements AiPlanningProvider {
  constructor(private readonly tasks?: GeneratedLearningTask[]) {}

  async generateLearningTasks(
    input: GenerateLearningTasksInput
  ): Promise<GeneratedLearningTask[]> {
    if (this.tasks) {
      return this.tasks.map(copyGeneratedTask);
    }

    return buildMockTasks(input);
  }
}

// ─── OpenAI 兼容 Provider ───────────────────────────────────
// 支持所有兼容 OpenAI Chat Completions 接口的 Agent API
// （OpenAI、DeepSeek、Kimi、Ollama 等），只需配置 baseUrl + model + apiKey。

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const OPENAI_DEFAULT_SYSTEM_PROMPT = `你是一个专业的学习规划师。用户会给你学习目标和总时长，你需要将目标拆解为结构化的学习任务。

要求：
1. 每个任务必须包含：阶段(phase)、标题(title)、描述(description)、预计时长(estimatedMinutes)、优先级(priority)、验收标准(acceptanceCriteria)
2. 任务应按学习逻辑分阶段，从基础到高级
3. 所有任务的预计时长之和应接近用户指定的总时长
4. 验收标准应具体可衡量

你必须以 JSON 数组格式返回，不要包含任何其他文本。格式如下：
[
  {
    "phase": "阶段名称",
    "title": "任务标题",
    "description": "任务描述",
    "estimatedMinutes": 120,
    "priority": 1,
    "acceptanceCriteria": ["标准1", "标准2"]
  }
]`;

export class OpenAiCompatibleProvider implements AiPlanningProvider {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async generateLearningTasks(
    input: GenerateLearningTasksInput
  ): Promise<GeneratedLearningTask[]> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const userMessage = [
      `学习目标：${input.goal}`,
      `总学习时长：${input.totalMinutes} 分钟（约 ${Math.round(input.totalMinutes / 60 * 10) / 10} 小时）`,
      "",
      "请将上述学习目标拆解为结构化的学习任务列表。"
    ].join("\n");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: OPENAI_DEFAULT_SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `AI API 请求失败 (${response.status}): ${errorBody.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI 返回内容为空");
    }

    return parseAiTasks(content);
  }
}

// 解析 AI 返回的 JSON 任务列表，容错处理 markdown 代码块包裹
function parseAiTasks(content: string): GeneratedLearningTask[] {
  let jsonText = content.trim();

  // 去掉 markdown 代码块包裹：```json ... ```
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }

  let parsed: Array<{
    phase?: string;
    title?: string;
    description?: string;
    estimatedMinutes?: number;
    priority?: number;
    acceptanceCriteria?: string[];
  }>;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI 返回的 JSON 格式无效，请重试或检查模型配置。");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI 返回的不是任务数组，请重试或检查模型配置。");
  }

  return parsed.map((item, index) => ({
    id: nextAiTaskId(),
    phase: item.phase ?? "其他",
    title: item.title ?? `任务 ${index + 1}`,
    description: item.description ?? "",
    estimatedMinutes: typeof item.estimatedMinutes === "number" ? item.estimatedMinutes : 60,
    priority: typeof item.priority === "number" ? item.priority : index + 1,
    acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
      ? item.acceptanceCriteria.filter((c): c is string => typeof c === "string")
      : ["完成学习"],
    orderIndex: index
  }));
}

export function validateGeneratedTasks({
  targetTotalMinutes,
  tasks
}: ValidateGeneratedTasksInput): ValidateGeneratedTasksResult {
  const errors: GeneratedTaskValidationError[] = [];

  tasks.forEach((task, index) => {
    if (task.title.trim().length === 0) {
      errors.push({
        code: "task.title.required",
        message: "Generated task title is required.",
        index,
        field: "title"
      });
    }

    if (task.estimatedMinutes <= 0) {
      errors.push({
        code: "task.estimatedMinutes.positive",
        message: "Generated task estimated minutes must be greater than 0.",
        index,
        field: "estimatedMinutes"
      });
    }

    if (task.acceptanceCriteria.length === 0) {
      errors.push({
        code: "task.acceptanceCriteria.required",
        message: "Generated task must include at least one acceptance criterion.",
        index,
        field: "acceptanceCriteria"
      });
    }
  });

  const generatedTotalMinutes = tasks.reduce(
    (sum, task) => sum + Math.max(0, task.estimatedMinutes),
    0
  );
  const warnings: GeneratedTaskValidationWarning[] = [];
  const allowedDeviation = targetTotalMinutes * TOTAL_MINUTES_WARNING_RATIO;

  if (
    targetTotalMinutes > 0 &&
    Math.abs(generatedTotalMinutes - targetTotalMinutes) > allowedDeviation
  ) {
    warnings.push({
      code: "task.totalMinutes.deviation",
      message: "Generated task minutes differ from the target by more than 10%.",
      targetTotalMinutes,
      generatedTotalMinutes
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// MVP 使用与原型图一致的示例任务阶段，便于演示和学习。
function buildMockTasks(input: GenerateLearningTasksInput): GeneratedLearningTask[] {
  const taskDefinitions = [
    {
      phase: "基础",
      title: "学习 React 基础语法",
      description: "掌握 JSX、组件、props 与 state 的核心概念。",
      priority: 1,
      acceptanceCriteria: [
        "能独立编写函数组件",
        "能解释 props 单向数据流"
      ]
    },
    {
      phase: "基础",
      title: "学习 JSX 与组件通信",
      description: "深入理解 JSX 规则以及父子组件间的数据传递。",
      priority: 1,
      acceptanceCriteria: [
        "能使用条件渲染和列表渲染",
        "能通过 props 和回调实现组件通信"
      ]
    },
    {
      phase: "基础",
      title: "使用 Vite 搭建项目",
      description: "使用 Vite 初始化 React + TypeScript 工程并配置基础结构。",
      priority: 1,
      acceptanceCriteria: [
        "成功运行 Vite 开发服务器",
        "能说明项目目录结构"
      ]
    },
    {
      phase: "Hooks",
      title: "学习 useState 与 useEffect",
      description: "掌握最常用的两个 Hook，理解状态生命周期和副作用管理。",
      priority: 2,
      acceptanceCriteria: [
        "能正确使用 useState 管理局部状态",
        "能使用 useEffect 处理异步副作用"
      ]
    },
    {
      phase: "Hooks",
      title: "自定义 Hook 实践",
      description: "抽取可复用逻辑为自定义 Hook，提升组件复用性。",
      priority: 2,
      acceptanceCriteria: [
        "能写出至少一个自定义 Hook",
        "能在多个组件中复用该 Hook"
      ]
    },
    {
      phase: "Router",
      title: "React Router 基础",
      description: "学习路由配置、导航与路由参数的使用。",
      priority: 3,
      acceptanceCriteria: [
        "能配置基础路由",
        "能使用 Link 进行页面跳转"
      ]
    },
    {
      phase: "Router",
      title: "嵌套路由与参数传递",
      description: "掌握嵌套路由、动态路由以及 URL 参数的读取。",
      priority: 3,
      acceptanceCriteria: [
        "能实现嵌套路由布局",
        "能通过 useParams 读取路由参数"
      ]
    },
    {
      phase: "项目实战",
      title: "实战：博客系统开发",
      description: "综合运用所学知识完成一个可运行的博客系统。",
      priority: 4,
      acceptanceCriteria: [
        "完成文章列表与详情页",
        "实现基础的数据增删改查"
      ]
    },
    {
      phase: "项目实战",
      title: "部署上线与性能优化",
      description: "学习构建、部署流程以及常见的性能优化手段。",
      priority: 4,
      acceptanceCriteria: [
        "成功构建并部署项目",
        "能列出至少两种优化措施"
      ]
    }
  ];
  const minutes = splitMinutes(input.totalMinutes, taskDefinitions.length);

  return taskDefinitions.map((task, index) => ({
    id: nextAiTaskId(),
    phase: task.phase,
    title: task.title,
    description: task.description,
    estimatedMinutes: minutes[index],
    priority: task.priority,
    acceptanceCriteria: task.acceptanceCriteria,
    orderIndex: index
  }));
}

function splitMinutes(totalMinutes: number, parts: number): number[] {
  const baseMinutes = Math.floor(totalMinutes / parts);
  let remainder = totalMinutes % parts;

  return Array.from({ length: parts }, () => {
    const extraMinute = remainder > 0 ? 1 : 0;
    remainder -= extraMinute;

    return baseMinutes + extraMinute;
  });
}

function copyGeneratedTask(task: GeneratedLearningTask): GeneratedLearningTask {
  return {
    ...task,
    acceptanceCriteria: [...task.acceptanceCriteria]
  };
}
