import axios, { AxiosInstance } from 'axios'

export interface GitLabProject {
  id: number
  name: string
  name_with_namespace: string
  description: string | null
  web_url: string
  http_url_to_repo: string
  default_branch: string
  visibility: 'private' | 'internal' | 'public'
  star_count: number
  forks_count: number
  created_at: string
  last_activity_at: string
  namespace: {
    id: number
    name: string
    path: string
  }
}

export interface GitLabUser {
  id: number
  username: string
  name: string
  email: string
  avatar_url: string
}

export class GitLabService {
  private client: AxiosInstance
  private token?: string

  constructor(token?: string, baseURL: string = 'https://gitlab.com/api/v4') {
    this.token = token
    this.client = axios.create({
      baseURL,
      headers: {
        ...(token && { 'PRIVATE-TOKEN': token }),
      },
    })
  }

  /**
   * Get authenticated user
   */
  async getAuthenticatedUser(): Promise<GitLabUser> {
    if (!this.token) {
      throw new Error('GitLab token required for authentication')
    }

    const response = await this.client.get('/user')
    return response.data
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<GitLabProject> {
    const response = await this.client.get(`/projects/${encodeURIComponent(projectId)}`)
    return response.data
  }

  /**
   * List user projects
   */
  async listUserProjects(params?: {
    owned?: boolean
    membership?: boolean
    per_page?: number
    page?: number
  }): Promise<GitLabProject[]> {
    const response = await this.client.get('/projects', {
      params: {
        owned: params?.owned ?? true,
        membership: params?.membership ?? true,
        per_page: params?.per_page || 20,
        page: params?.page || 1,
      },
    })

    return response.data
  }

  /**
   * Get project branches
   */
  async getBranches(projectId: string): Promise<any[]> {
    const response = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/repository/branches`
    )
    return response.data
  }

  /**
   * Get project commits
   */
  async getCommits(
    projectId: string,
    params?: {
      ref_name?: string
      per_page?: number
      page?: number
    }
  ): Promise<any[]> {
    const response = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/repository/commits`,
      {
        params: {
          ref_name: params?.ref_name,
          per_page: params?.per_page || 100,
          page: params?.page || 1,
        },
      }
    )

    return response.data
  }

  /**
   * Get project contributors
   */
  async getContributors(projectId: string): Promise<any[]> {
    const response = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/repository/contributors`
    )
    return response.data
  }

  /**
   * Parse GitLab URL
   */
  static parseGitLabUrl(url: string): { projectPath: string } | null {
    const patterns = [/gitlab\.com\/([^\/]+\/[^\/]+?)(?:\.git)?$/, /gitlab\.com\/([^\/]+\/[^\/]+)/]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return { projectPath: match[1].replace(/\.git$/, '') }
      }
    }

    return null
  }

  /**
   * Validate token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getAuthenticatedUser()
      return true
    } catch {
      return false
    }
  }
}

export const gitlabService = new GitLabService()
