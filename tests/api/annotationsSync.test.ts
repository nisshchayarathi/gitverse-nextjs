import { expect, test, describe, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/annotations/sync/route';
import { requireAuth, isHttpError, HttpError } from '@/lib/middleware';
import { RepositoryAccess } from '../../services/authz/repository-access';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { addClient, removeClient } from '@/lib/services/annotationSync';

// Mock dependencies
vi.mock('@/lib/middleware', () => ({
  requireAuth: vi.fn(),
  isHttpError: vi.fn((err) => err instanceof Error && 'status' in err),
}));

vi.mock('../../services/authz/repository-access', () => ({
  RepositoryAccess: {
    checkAccess: vi.fn(),
  },
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((rl, msg) => new Response(msg || 'Rate limited', { status: 429 })),
  RATE_LIMITS: {
    ANNOTATION_SYNC: { namespace: 'annotation:sync', maxRequests: 10, windowMs: 60000 },
  },
}));

vi.mock('@/lib/services/annotationSync', () => ({
  addClient: vi.fn(),
  removeClient: vi.fn(),
}));

describe('Annotation Sync SSE API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 401 for unauthenticated requests', async () => {
    const error = new Error('Unauthorized') as any;
    error.status = 401;
    vi.mocked(requireAuth).mockRejectedValueOnce(error);

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=1') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('returns 400 when repositoryId is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });

    const req = new Request('http://localhost/api/annotations/sync') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toBe('Missing repositoryId');
  });

  test('returns 400 when repositoryId is invalid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=invalid') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toBe('Invalid repositoryId');
  });

  test('returns 403 when repository access is denied', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });
    vi.mocked(RepositoryAccess.checkAccess).mockResolvedValueOnce({
      allowed: false,
      repositoryExists: true,
      reason: 'Unauthorized access to repository',
    });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=1') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toBe('Forbidden: Access denied');
  });

  test('returns 404 when repository does not exist', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });
    vi.mocked(RepositoryAccess.checkAccess).mockResolvedValueOnce({
      allowed: false,
      repositoryExists: false,
      reason: 'Repository not found',
    });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=1') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toBe('Repository not found');
  });

  test('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });
    vi.mocked(RepositoryAccess.checkAccess).mockResolvedValueOnce({
      allowed: true,
      repositoryExists: true,
      role: 'REPO_ADMIN',
    });
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      limit: 10,
    });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=1') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(429);
    const body = await res.text();
    expect(body).toBe('Too many sync connections');
  });

  test('establishes SSE connection and registers client when all checks pass', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });
    vi.mocked(RepositoryAccess.checkAccess).mockResolvedValueOnce({
      allowed: true,
      repositoryExists: true,
      role: 'REPO_ADMIN',
    });
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
      limit: 10,
    });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=1&token=mock-token') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');

    // Make sure requireAuth was called with authorization header modified from token parameter
    expect(req.headers.get('authorization')).toBe('Bearer mock-token');
  });

  test('canonicalizes repositoryId when registering client', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: 'user@example.com' });
    vi.mocked(RepositoryAccess.checkAccess).mockResolvedValueOnce({
      allowed: true,
      repositoryExists: true,
      role: 'REPO_ADMIN',
    });
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
      limit: 10,
    });

    const req = new Request('http://localhost/api/annotations/sync?repositoryId=0123') as any;
    req.nextUrl = new URL(req.url);

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(addClient).toHaveBeenCalledWith('123', expect.any(Object));
  });
});
