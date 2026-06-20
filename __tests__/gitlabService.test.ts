import axios from 'axios'
import { GitLabService } from '../lib/services/gitlabService'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('GitLabService', () => {
  let service: GitLabService
  const mockGet = jest.fn()
  const mockInterceptors = {
    response: {
      use: jest.fn(),
    },
  }

  beforeEach(() => {
    mockInterceptors.response.use.mockReset()
    mockedAxios.create.mockReturnValue({
      get: mockGet,
      interceptors: mockInterceptors,
    } as any)
    mockedAxios.isAxiosError.mockImplementation(
      (err: any) => err && !!err.isAxiosError
    )
    service = new GitLabService('test-token')
    mockGet.mockReset()
  })

  describe('constructor', () => {
    it('creates client with PRIVATE-TOKEN header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://gitlab.com/api/v4',
          headers: expect.objectContaining({
            'PRIVATE-TOKEN': 'test-token',
          }),
        })
      )
    })

    it('creates client with custom baseURL', () => {
      new GitLabService('token', 'https://custom.gitlab.com/api/v4')
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom.gitlab.com/api/v4',
        })
      )
    })

    it('creates client without auth header when no token', () => {
      new GitLabService()
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'PRIVATE-TOKEN': expect.anything(),
          }),
        })
      )
    })
  })

  describe('getAuthenticatedUser', () => {
    it('returns user data', async () => {
      mockGet.mockResolvedValue({ data: { username: 'testuser', id: 1 } })
      const user = await service.getAuthenticatedUser()
      expect(mockGet).toHaveBeenCalledWith('/user')
      expect(user.username).toBe('testuser')
    })

    it('throws error when no token', async () => {
      const s = new GitLabService()
      await expect(s.getAuthenticatedUser()).rejects.toThrow(
        'GitLab token required for authentication'
      )
    })
  })

  describe('getProject', () => {
    it('returns project data', async () => {
      const mockProject = { id: 1, name: 'test-project' }
      mockGet.mockResolvedValue({ data: mockProject })
      const project = await service.getProject('namespace/repo')
      expect(mockGet).toHaveBeenCalledWith(
        `/projects/${encodeURIComponent('namespace/repo')}`
      )
      expect(project).toEqual(mockProject)
    })
  })

  describe('listUserProjects', () => {
    it('returns projects with default params', async () => {
      mockGet.mockResolvedValue({ data: [] })
      await service.listUserProjects()
      expect(mockGet).toHaveBeenCalledWith('/projects', {
        params: { owned: true, membership: true, per_page: 20, page: 1 },
      })
    })

    it('returns projects with custom params', async () => {
      mockGet.mockResolvedValue({ data: [] })
      await service.listUserProjects({ owned: false, per_page: 10, page: 2 })
      expect(mockGet).toHaveBeenCalledWith('/projects', {
        params: { owned: false, membership: true, per_page: 10, page: 2 },
      })
    })
  })

  describe('getBranches', () => {
    it('returns branches for project', async () => {
      mockGet.mockResolvedValue({ data: [{ name: 'main' }] })
      const branches = await service.getBranches('namespace/repo')
      expect(mockGet).toHaveBeenCalledWith(
        `/projects/${encodeURIComponent('namespace/repo')}/repository/branches`
      )
      expect(branches).toHaveLength(1)
    })
  })

  describe('getCommits', () => {
    it('returns commits with default params', async () => {
      mockGet.mockResolvedValue({ data: [] })
      await service.getCommits('namespace/repo')
      expect(mockGet).toHaveBeenCalledWith(
        `/projects/${encodeURIComponent('namespace/repo')}/repository/commits`,
        { params: { ref_name: undefined, per_page: 100, page: 1 } }
      )
    })
  })

  describe('parseGitLabUrl', () => {
    it('parses standard HTTPS URL', () => {
      const result = GitLabService.parseGitLabUrl(
        'https://gitlab.com/namespace/repo'
      )
      expect(result).toEqual({ projectPath: 'namespace/repo' })
    })

    it('parses .git URL', () => {
      const result = GitLabService.parseGitLabUrl(
        'https://gitlab.com/namespace/repo.git'
      )
      expect(result).toEqual({ projectPath: 'namespace/repo' })
    })

    it('returns null for non-GitLab URL', () => {
      const result = GitLabService.parseGitLabUrl('https://github.com/user/repo')
      expect(result).toBeNull()
    })
  })

  describe('validateToken', () => {
    it('returns true when token is valid', async () => {
      mockGet.mockResolvedValue({ data: { username: 'testuser' } })
      const result = await service.validateToken()
      expect(result).toBe(true)
    })

    it('returns false when API call fails', async () => {
      mockGet.mockRejectedValue(new Error('Unauthorized'))
      const result = await service.validateToken()
      expect(result).toBe(false)
    })
  })

  describe('Axios Response Interceptor', () => {
    let onFulfilled: any
    let onRejected: any

    beforeEach(() => {
      expect(mockInterceptors.response.use).toHaveBeenCalled()
      const calls = mockInterceptors.response.use.mock.calls[0]
      onFulfilled = calls[0]
      onRejected = calls[1]
    })

    it('passes through successful responses', () => {
      const mockResponse = { data: 'success' }
      const result = onFulfilled(mockResponse)
      expect(result).toBe(mockResponse)
    })

    it('propagates non-Axios errors unchanged', async () => {
      const error = new Error('Normal Error')
      await expect(onRejected(error)).rejects.toThrow('Normal Error')
    })

    it('throws GitLabRateLimitError with default retry duration on 429 without headers', async () => {
      const error = {
        isAxiosError: true,
        config: { headers: {} },
        response: {
          status: 429,
          headers: {},
        },
      }
      await expect(onRejected(error)).rejects.toThrow(
        'GitLab API rate limit reached. Please retry after 60 seconds.'
      )
    })

    it('throws GitLabRateLimitError with custom retry duration from retry-after header', async () => {
      const error = {
        isAxiosError: true,
        config: { headers: {} },
        response: {
          status: 429,
          headers: {
            'retry-after': '30',
          },
        },
      }
      await expect(onRejected(error)).rejects.toThrow(
        'GitLab API rate limit reached. Please retry after 30 seconds.'
      )
    })

    it('throws GitLabRateLimitError with custom retry duration from ratelimit-reset header', async () => {
      const now = Date.now()
      const resetTimeSeconds = Math.floor(now / 1000) + 45
      const error = {
        isAxiosError: true,
        config: { headers: {} },
        response: {
          status: 403,
          headers: {
            'ratelimit-remaining': '0',
            'ratelimit-reset': resetTimeSeconds.toString(),
          },
        },
      }
      const promise = onRejected(error)
      await expect(promise).rejects.toThrow(
        'GitLab API rate limit reached. Please retry after 45 seconds.'
      )
    })

    it('retries up to 3 times on 502, 503, 504 errors', async () => {
      const mockClient = jest.fn().mockResolvedValue({ data: 'retry-success' })
      const error = {
        isAxiosError: true,
        config: {
          headers: {},
          retryCount: 0,
        },
        response: {
          status: 503,
        },
      }

      ;(service as any).client = mockClient

      const promise = onRejected(error)
      const result = await promise

      expect(error.config.retryCount).toBe(1)
      expect(mockClient).toHaveBeenCalledWith(error.config)
      expect(result).toEqual({ data: 'retry-success' })
    })

    it('fails after 3 retries', async () => {
      const error = {
        isAxiosError: true,
        config: {
          headers: {},
          retryCount: 3,
        },
        response: {
          status: 503,
        },
      }

      await expect(onRejected(error)).rejects.toEqual(error)
    })

    it('redacts PRIVATE-TOKEN and Authorization headers on error', async () => {
      const error = {
        isAxiosError: true,
        config: {
          headers: {
            'PRIVATE-TOKEN': 'secret-token',
            'Authorization': 'Bearer secret-bearer',
            'Content-Type': 'application/json',
          },
        },
        response: {
          status: 400,
        },
      }

      await expect(onRejected(error)).rejects.toThrow()
      expect(error.config.headers['PRIVATE-TOKEN']).toBe('[REDACTED]')
      expect(error.config.headers['Authorization']).toBe('[REDACTED]')
      expect(error.config.headers['Content-Type']).toBe('application/json')
    })
  })
})