import prisma from "../prisma";
import { DataResidencyRegion } from "@prisma/client";

export class RegionRouterService {
  /**
   * Determine the active data residency region for a given organization.
   */
  public async getOrganizationRegion(organizationId: string): Promise<DataResidencyRegion> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { dataResidencyRegion: true },
    });

    if (!org) {
      // Default to US if not found to ensure safe fallback
      return DataResidencyRegion.US;
    }

    return org.dataResidencyRegion;
  }

  /**
   * Determine the active data residency region for a given repository.
   * Inherits from organization unless overriden.
   */
  public async getRepositoryRegion(repositoryId: number): Promise<DataResidencyRegion> {
    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { 
        inheritedRegion: true,
        overrideAllowed: true,
        policyAssignment: {
          select: { organizationId: true }
        }
      },
    });

    if (!repo) {
      return DataResidencyRegion.US;
    }

    if (repo.inheritedRegion && repo.overrideAllowed) {
      return repo.inheritedRegion;
    }

    if (repo.policyAssignment?.organizationId) {
      return this.getOrganizationRegion(repo.policyAssignment.organizationId);
    }

    // Default fallback
    return DataResidencyRegion.US;
  }

  /**
   * Helper to ensure valid routing context
   */
  public async determineActiveRegion(context: {
    organizationId?: string;
    repositoryId?: number;
  }): Promise<DataResidencyRegion> {
    if (context.repositoryId) {
      return this.getRepositoryRegion(context.repositoryId);
    }
    
    if (context.organizationId) {
      return this.getOrganizationRegion(context.organizationId);
    }

    return DataResidencyRegion.US;
  }
}

let regionRouterSingleton: RegionRouterService | null = null;

export function getRegionRouterService(): RegionRouterService {
  if (!regionRouterSingleton) {
    regionRouterSingleton = new RegionRouterService();
  }
  return regionRouterSingleton;
}
