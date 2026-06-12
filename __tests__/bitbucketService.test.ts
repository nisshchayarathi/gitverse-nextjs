import axios from 'axios'
import { BitbucketService } from '../lib/services/bitbucketService'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('BitbucketService', () => {
  let service: BitbucketService
  const mockGet = jest.fn()

  beforeEach(() => {
    mockedAxios.create.mockReturnValue({ get: mockGet } as any)
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
})