import axios from 'axios'
import { BitbucketService } from '../lib/services/bitbucketService'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('BitbucketService', () => {
  let service: BitbucketService
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
    service = new BitbucketService('test-token')
    mockGet.mockReset()
  })

  describe('constructor', () => {
    it('creates client with token auth header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.bitbucket.org/2.0',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('creates client without auth header when no token', () => {
      new BitbucketService()
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      )
    })
  })

  describe('getAuthenticatedUser', () => {
    it('returns user data', async () => {
      mockGet.mockResolvedValue({ data: { username: 'testuser' } })
      const user = await service.getAuthenticatedUser()
      expect(mockGet).toHaveBeenCalledWith('/user')
      expect(user).toEqual({ username: 'testuser' })
    })

    it('throws error when no token', async () => {
      const s = new BitbucketService()
      await expect(s.getAuthenticatedUser()).rejects.toThrow(
        'Bitbucket token required for authentication'
      )
    })
  })

  describe('getRepository', () => {
    it('returns repository data', async () => {
      const mockRepo = { uuid: '123', name: 'test-repo' }
      mockGet.mockResolvedValue({ data: mockRepo })
      const repo = await service.getRepository('workspace', 'test-repo')
      expect(mockGet).toHaveBeenCalledWith('/repositories/workspace/test-repo')
      expect(repo).toEqual(mockRepo)
    })
  })

  describe('listUserRepositories', () => {
    it('returns repositories with default params', async () => {
      mockGet.mockResolvedValue({ data: { values: [] } })
      await service.listUserRepositories()
      expect(mockGet).toHaveBeenCalledWith('/repositories', {
        params: { pagelen: 20, page: 1 },
      })
    })

    it('returns repositories with custom params', async () => {
      mockGet.mockResolvedValue({ data: { values: [] } })
      await service.listUserRepositories({ per_page: 10, page: 2 })
      expect(mockGet).toHaveBeenCalledWith('/repositories', {
        params: { pagelen: 10, page: 2 },
      })
    })
  })

  describe('parseBitbucketUrl', () => {
    it('parses standard HTTPS URL', () => {
      const result = BitbucketService.parseBitbucketUrl(
        'https://bitbucket.org/workspace/repo'
      )
      expect(result).toEqual({ workspace: 'workspace', repoSlug: 'repo' })
    })

    it('parses .git URL', () => {
      const result = BitbucketService.parseBitbucketUrl(
        'https://bitbucket.org/workspace/repo.git'
      )
      expect(result).toEqual({ workspace: 'workspace', repoSlug: 'repo' })
    })

    it('returns null for invalid URL', () => {
      const result = BitbucketService.parseBitbucketUrl('https://github.com/user/repo')
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

    it('throws BitbucketRateLimitError with default retry duration on 429 without headers', async () => {
      const error = {
        isAxiosError: true,
        config: { headers: {} },
        response: {
          status: 429,
          headers: {},
        },
      }
      await expect(onRejected(error)).rejects.toThrow(
        'Bitbucket API rate limit reached. Please retry after 60 seconds.'
      )
    })

    it('throws BitbucketRateLimitError with custom retry duration from retry-after header', async () => {
      const error = {
        isAxiosError: true,
        config: { headers: {} },
        response: {
          status: 429,
          headers: {
            'retry-after': '45',
          },
        },
      }
      await expect(onRejected(error)).rejects.toThrow(
        'Bitbucket API rate limit reached. Please retry after 45 seconds.'
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

    it('redacts Authorization headers on error', async () => {
      const error = {
        isAxiosError: true,
        config: {
          headers: {
            'Authorization': 'Bearer secret-bearer',
            'Content-Type': 'application/json',
          },
        },
        response: {
          status: 400,
        },
      }

      await expect(onRejected(error)).rejects.toThrow()
      expect(error.config.headers['Authorization']).toBe('[REDACTED]')
      expect(error.config.headers['Content-Type']).toBe('application/json')
    })
  })
})