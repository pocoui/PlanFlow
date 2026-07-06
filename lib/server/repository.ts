import {
  createInMemoryPlanRepository,
  createPrismaPlanRepository,
  type PlanRepository
} from "@/lib/services/planService";

const globalForRepo = globalThis as unknown as {
  __planflowRepository?: PlanRepository;
};

export function getRepository(): PlanRepository {
  if (!globalForRepo.__planflowRepository) {
    // 优先使用 Prisma（PostgreSQL），DATABASE_URL 未配置时回退到内存存储
    if (process.env.DATABASE_URL) {
      console.log("[repository] Using Prisma (PostgreSQL) repository");
      globalForRepo.__planflowRepository = createPrismaPlanRepository();
    } else {
      console.log("[repository] Using in-memory repository (fallback)");
      globalForRepo.__planflowRepository = createInMemoryPlanRepository();
    }
  }

  return globalForRepo.__planflowRepository;
}
