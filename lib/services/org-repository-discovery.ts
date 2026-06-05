import { GitHubService } from "./githubService";
import { OrgRepository } from "../../types/distributed-rag";

export class OrgRepositoryDiscovery {
  private githubService: GitHubService;

  constructor(token?: string) {
    this.githubService = new GitHubService(token);
  }

  async discoverOrganizationRepositories(orgName: string): Promise<OrgRepository[]> {
    try {
      const query = `org:${orgName} archived:false`;
      let allRepos: OrgRepository[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.githubService.searchRepositories(query, { per_page: 100, page });
        
        const mappedRepos = response.items.map(repo => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          url: repo.html_url,
          defaultBranch: repo.default_branch,
          description: repo.description || undefined,
          languages: repo.language ? [repo.language] : [],
          updatedAt: repo.updated_at
        }));

        allRepos = [...allRepos, ...mappedRepos];

        if (response.items.length < 100 || page >= 5) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allRepos;
    } catch (error) {
      console.error(`Error discovering repositories for org ${orgName}:`, error);
      throw error;
    }
  }

  async synchronizeOrganization(orgName: string): Promise<OrgRepository[]> {
    console.log(`Synchronizing repositories for organization: ${orgName}`);
    const repos = await this.discoverOrganizationRepositories(orgName);
    console.log(`Discovered ${repos.length} active repositories in ${orgName}`);
    return repos;
  }
}
