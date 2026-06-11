import axios from 'axios'
import { GitLabService } from '../lib/services/gitlabService'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('GitLabService', () => {
  let service: GitLabService
  const mockGet = jest.fn()

  beforeEach(() => {
    mockedAxios.create.mockReturnValue({ get: mockGet } as any)
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
})