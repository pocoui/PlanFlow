import {
  createInMemoryPlanRepository,
  type PlanRepository
} from "@/lib/services/planService";

const globalForRepo = globalThis as unknown as {
  __planflowRepository?: PlanRepository;
};

export function getRepository(): PlanRepository {
  if (!globalForRepo.__planflowRepository) {
    globalForRepo.__planflowRepository = createInMemoryPlanRepository();
  }

  return globalForRepo.__planflowRepository;
}
