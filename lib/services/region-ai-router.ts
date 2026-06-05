import { getRegionRouterService } from "./region-router";
import { getComplianceEnforcementService } from "./compliance-enforcement";
import { DataResidencyRegion } from "@prisma/client";

export class RegionAiRouterService {
  /**
   * Routes AI requests (Gemini analysis, embeddings) to the correct regional endpoint.
   * Enforces compliance before proceeding.
   */
  public async routeAiRequest(params: {
    organizationId: string;
    repositoryId?: number;
    requestedByRegion?: string;
    resource: string;
    action: string;
  }): Promise<DataResidencyRegion> {
    const routerService = getRegionRouterService();
    const enforcementService = getComplianceEnforcementService();

    // 1. Determine active region
    const targetRegion = await routerService.determineActiveRegion({
      organizationId: params.organizationId,
      repositoryId: params.repositoryId,
    });

    // 2. Validate compliance if an external region was specified
    const attemptedRegion = params.requestedByRegion || targetRegion;

    await enforcementService.enforceCompliance({
      organizationId: params.organizationId,
      repositoryId: params.repositoryId,
      targetRegion,
      attemptedRegion,
      resource: params.resource,
      action: params.action,
    });

    return targetRegion;
  }
}

let regionAiRouterSingleton: RegionAiRouterService | null = null;

export function getRegionAiRouterService(): RegionAiRouterService {
  if (!regionAiRouterSingleton) {
    regionAiRouterSingleton = new RegionAiRouterService();
  }
  return regionAiRouterSingleton;
}
