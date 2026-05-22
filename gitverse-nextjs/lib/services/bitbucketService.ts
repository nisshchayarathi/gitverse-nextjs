import axios, { AxiosInstance } from 'axios'

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
