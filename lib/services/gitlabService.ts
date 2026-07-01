import axios, { AxiosError, AxiosInstance, isAxiosError } from 'axios'
import { computeBackoffMs } from '@/lib/utils/retry'

export class GitLabRateLimitError extends Error {
  retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super(
      `GitLab API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`
    )
    this.name = 'GitLabRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function sanitizeGitLabHeaders(headers: any): any {
  if (headers == null) {
    return headers
  }

  if (Array.isArray(headers)) {
    return headers.map((value) => sanitizeGitLabHeaders(value))
  }

  if (typeof headers !== 'object') {
    return headers
  }

  const source =
    typeof (headers as any).toJSON === 'function'
      ? (headers as any).toJSON()
      : headers

  if (source == null || typeof source !== 'object') {
    return source
  }

  const sanitized: Record<string, any> = Array.isArray(source) ? [] : {}

  for (const [key, value] of Object.entries(source)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'authorization' || lowerKey === 'private-token') {
      sanitized[key] = '[REDACTED]'
    } else if (value != null && typeof value === 'object') {
      sanitized[key] = sanitizeGitLabHeaders(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function sanitizeGitLabError(error: any) {
  if (isAxiosError(error) && error.config) {
    const safeConfig = {
      ...error.config,
      headers: sanitizeGitLabHeaders(error.config.headers),
    }
    error.config = safeConfig as any
  }
  return error
}

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

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!isAxiosError(error) || !error.config) {
          throw sanitizeGitLabError(error)
        }

        const status = error.response?.status
        const config = error.config as any

        const headers = error.response?.headers || {}
        if (status === 429 || status === 403) {
          const rateLimitRemaining =
            headers['ratelimit-remaining'] || headers['x-ratelimit-remaining']
          if (status === 429 || rateLimitRemaining === '0') {
            const retryAfterHeader = headers['retry-after']
            const resetHeader =
              headers['ratelimit-reset'] || headers['x-ratelimit-reset']
            let retrySeconds = 60

            if (retryAfterHeader) {
              retrySeconds = parseInt(String(retryAfterHeader), 10)
            } else if (resetHeader) {
              const resetTime = parseInt(String(resetHeader), 10) * 1000
              retrySeconds = Math.max(
                1,
                Math.ceil((resetTime - Date.now()) / 1000)
              )
            }
            throw new GitLabRateLimitError(retrySeconds)
          }
        }

        const retryStatusCodes = [502, 503, 504]
        if (
          (status && retryStatusCodes.includes(status)) ||
          error.code === 'ECONNABORTED' ||
          !error.response
        ) {
          config.retryCount = config.retryCount || 0
          if (config.retryCount < 3) {
            config.retryCount += 1
            const backoff =
              computeBackoffMs(config.retryCount - 1) + Math.random() * 1000
            await new Promise((resolve) => setTimeout(resolve, backoff))
            return this.client(config)
          }
        }

        throw sanitizeGitLabError(error)
      }
    )
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
