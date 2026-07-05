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
  const tasks = await provider.generateLearningTasks(input);
  const validation = validateGeneratedTasks({
    targetTotalMinutes: input.totalMinutes,
    tasks
  });

  if (!validation.valid) {
    throw new Error("Generated learning tasks are invalid.");
  }

  return {
    tasks,
    warnings: validation.warnings
  };
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
    id: `mock-task-${index + 1}`,
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
