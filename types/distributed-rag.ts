export interface OrgRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  defaultBranch: string;
  description?: string;
  languages: string[];
  updatedAt: string;
}

export interface CrossRepoDependency {
  sourceRepo: string;
  targetRepo: string;
  dependencyType: 'import' | 'api' | 'package' | 'sdk';
  sourceFile: string;
  targetFile?: string;
  description?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  type: 'repository' | 'service' | 'api' | 'interface' | 'package' | 'file';
  metadata: Record<string, any>;
  dependencies: string[];
  dependents: string[];
}

export interface CrossRepoImpactReport {
  modifiedRepository: string;
  potentiallyAffectedRepositories: string[];
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  reason: string;
  details: string[];
}

export interface DistributedIndexResult {
  repositoryId: number;
  repositoryName: string;
  filesIndexed: number;
  tokensIndexed: number;
  dependenciesMapped: number;
  timestamp: string;
}
