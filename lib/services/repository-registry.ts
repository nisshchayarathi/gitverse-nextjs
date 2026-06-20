import { OrgRepository } from "../../types/distributed-rag";

export class RepositoryRegistry {
  private registry: Map<string, OrgRepository> = new Map();
  private lastSynced: Map<string, Date> = new Map();

  registerRepositories(orgName: string, repositories: OrgRepository[]): void {
    repositories.forEach(repo => {
      this.registry.set(repo.fullName, repo);
      this.registry.set(repo.id.toString(), repo);
    });
    this.lastSynced.set(orgName, new Date());
  }

  getRepository(identifier: string | number): OrgRepository | undefined {
    return this.registry.get(identifier.toString());
  }

  getAllRepositoriesForOrg(orgName: string): OrgRepository[] {
    return Array.from(this.registry.values()).filter(repo => repo.owner.toLowerCase() === orgName.toLowerCase());
  }

  isRegistryStale(orgName: string, ttlMs: number = 3600000): boolean {
    const lastSync = this.lastSynced.get(orgName);
    if (!lastSync) return true;
    return (new Date().getTime() - lastSync.getTime()) > ttlMs;
  }
}

export const repositoryRegistry = new RepositoryRegistry();
