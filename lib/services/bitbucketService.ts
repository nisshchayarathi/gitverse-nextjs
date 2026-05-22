import axios, { AxiosInstance, isAxiosError } from 'axios'
import { getRetryDelayMs } from '@/lib/utils/rateLimit'

export class BitbucketRateLimitError extends Error {
  retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super(
      retryAfterSeconds > 0
        ? `Bitbucket API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`
        : 'Bitbucket API rate limit reached. Please try again later.',
    )
    this.name = 'BitbucketRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function sanitizeBitbucketError(error: any) {
  if (isAxiosError(error) && error.config) {
    const safeConfig = {
      ...error.config,
      headers: error.config.headers
        ? {
            ...error.config.headers,
            Authorization: '[REDACTED]',
          }
        : error.config.headers,
    }
    error.config = safeConfig as any
  }
  return error
}

export interface BitbucketRepository {
  uuid: string
  name: string
  full_name: string
  description: string | null
  links: {
    html: { href: string }
    clone: Array<{ name: string; href: string }>
  }
  mainbranch?: {
    name: string
  }
  is_private: boolean
  size: number
  created_on: string
  updated_on: string
  owner: {
    username: string
    display_name: string
  }
}

export class BitbucketService {
  private client: AxiosInstance
  private token?: string

  constructor(token?: string) {
    this.token = token
    this.client = axios.create({
      baseURL: 'https://api.bitbucket.org/2.0',
      headers: {
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!isAxiosError(error) || !error.config) {
          throw sanitizeBitbucketError(error)
        }

        const status = error.response?.status
        const config = error.config as any
        config.retryCount = config.retryCount || 0

        if (status === 429) {
          if (config.retryCount >= 3) {
            const retryAfterHeader = error.response?.headers?.['retry-after']
            const retrySeconds = retryAfterHeader
              ? Math.max(1, parseInt(retryAfterHeader, 10))
              : 60
            throw new BitbucketRateLimitError(retrySeconds)
          }
          config.retryCount += 1
          const delayMs = getRetryDelayMs(error, config.retryCount) ?? 1000
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          return this.client(config)
        }

        const retryableCodes = [502, 503, 504]
        if (
          (status && retryableCodes.includes(status)) ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          !error.response
        ) {
          if (config.retryCount < 3) {
            config.retryCount += 1
            const backoff = Math.pow(2, config.retryCount) * 1000 + Math.random() * 1000
            await new Promise((resolve) => setTimeout(resolve, backoff))
            return this.client(config)
          }
        }

        throw sanitizeBitbucketError(error)
      },
    )
  }

  /**
   * Get authenticated user
   */
  async getAuthenticatedUser(): Promise<any> {
    if (!this.token) {
      throw new Error('Bitbucket token required for authentication')
    }

    const response = await this.client.get('/user')
    return response.data
  }

  /**
   * Get repository
   */
  async getRepository(workspace: string, repoSlug: string): Promise<BitbucketRepository> {
    const response = await this.client.get(`/repositories/${workspace}/${repoSlug}`)
    return response.data
  }

  /**
   * List user repositories
   */
  async listUserRepositories(params?: {
    per_page?: number
    page?: number
  }): Promise<{ values: BitbucketRepository[] }> {
    const response = await this.client.get('/repositories', {
      params: {
        pagelen: params?.per_page || 20,
        page: params?.page || 1,
      },
    })

    return response.data
  }

  /**
   * Parse Bitbucket URL
   */
  static parseBitbucketUrl(url: string): { workspace: string; repoSlug: string } | null {
    const patterns = [
      /bitbucket\.org\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /bitbucket\.org\/([^\/]+)\/([^\/]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return {
          workspace: match[1],
          repoSlug: match[2].replace(/\.git$/, ''),
        }
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

export const bitbucketService = new BitbucketService()
