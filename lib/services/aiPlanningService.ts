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

export async function generateLearningTasks(
  input: GenerateLearningTasksInput,
  provider: AiPlanningProvider = new MockAiPlanningProvider()
): Promise<GeneratedLearningTask[]> {
  const tasks = await provider.generateLearningTasks(input);
  const validation = validateGeneratedTasks({
    targetTotalMinutes: input.totalMinutes,
    tasks
  });

  if (!validation.valid) {
    throw new Error("Generated learning tasks are invalid.");
  }

  return tasks;
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

function buildMockTasks(input: GenerateLearningTasksInput): GeneratedLearningTask[] {
  const phases = [
    {
      phase: "Foundation",
      title: `Understand ${input.title} fundamentals`,
      description: `Read and summarize the core ideas needed for ${input.goal}.`,
      priority: 1,
      acceptanceCriteria: [
        "Can explain the core concepts in your own words.",
        "Has notes for follow-up practice."
      ]
    },
    {
      phase: "Practice",
      title: `Build a small ${input.title} exercise`,
      description: "Turn the concepts into a small hands-on implementation.",
      priority: 2,
      acceptanceCriteria: [
        "Completes a working practice exercise.",
        "Can identify the main implementation tradeoffs."
      ]
    },
    {
      phase: "Review",
      title: `Review and consolidate ${input.title}`,
      description: "Review weak points and prepare a concise summary.",
      priority: 3,
      acceptanceCriteria: [
        "Creates a final checklist of learned topics.",
        "Can describe next steps for deeper learning."
      ]
    }
  ];
  const minutes = splitMinutes(input.totalMinutes, phases.length);

  return phases.map((phase, index) => ({
    id: `mock-task-${index + 1}`,
    phase: phase.phase,
    title: phase.title,
    description: phase.description,
    estimatedMinutes: minutes[index],
    priority: phase.priority,
    acceptanceCriteria: phase.acceptanceCriteria,
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
