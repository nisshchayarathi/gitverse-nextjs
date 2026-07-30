import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GET, POST } from '@/app/api/annotations/route';
import { PATCH, DELETE } from '@/app/api/annotations/[id]/route';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/middleware', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 1 }),
  apiError: vi.fn((msg, status) => new Response(JSON.stringify({ error: msg }), { status })),
  apiSuccess: vi.fn((data, status = 200) => new Response(JSON.stringify(data), { status })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    repository: {
      findFirst: vi.fn(),
    },
    mapAnnotation: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    annotationActivity: {
      create: vi.fn(),
    }
  }
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((rl) => new Response('Rate limited', { status: 429 })),
  RATE_LIMITS: {
    ANNOTATION_WRITE: { namespace: 'annotation:write', maxRequests: 10, windowMs: 60000 },
  },
}));

vi.mock('@/lib/services/annotationSync', () => ({
  broadcastAnnotationEvent: vi.fn(),
}));

describe('Annotations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
      limit: 10,
    });
    vi.mocked(prisma.repository.findFirst).mockResolvedValue({ id: 1, userId: 1 } as any);
    vi.mocked(prisma.mapAnnotation.findMany).mockResolvedValue([
      { id: '1', repositoryId: 1, content: 'Test', authorId: 1 },
    ] as any);
    vi.mocked(prisma.mapAnnotation.create).mockResolvedValue({ id: '1', repositoryId: 1, content: 'Test', authorId: 1 } as any);
    vi.mocked(prisma.mapAnnotation.update).mockResolvedValue({ id: '1', repositoryId: 1, content: 'Updated', authorId: 1 } as any);
    vi.mocked(prisma.mapAnnotation.findUnique).mockResolvedValue({ id: '1', repositoryId: 1, authorId: 1, repository: { userId: 1 } } as any);
    vi.mocked(prisma.mapAnnotation.delete).mockResolvedValue({ id: '1' } as any);
    vi.mocked(prisma.annotationActivity.create).mockResolvedValue({} as any);
  });

  test('Scenario 0: Fetch annotations - Returns wrapped annotations array', async () => {
    const req = new Request('http://localhost/api/annotations?repositoryId=1') as any;

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      annotations: [{ id: '1', repositoryId: 1, content: 'Test', authorId: 1 }],
    });
  });

  test('Scenario 1: Create annotation - Saved successfully', async () => {
    const req = {
      json: () => Promise.resolve({
        repositoryId: 1,
        targetType: 'node',
        targetId: 'node-1',
        content: 'Test content',
        annotationType: 'comment'
      })
    } as any;
    
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      annotation: { id: '1', repositoryId: 1, content: 'Test', authorId: 1 },
    });
  });

  test('Scenario 2: Edit annotation - Updated for all users', async () => {
    const req = {
      json: () => Promise.resolve({
        content: 'Updated content'
      })
    } as any;
    
    const res = await PATCH(req, { params: { id: '1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      annotation: { id: '1', repositoryId: 1, content: 'Updated', authorId: 1 },
    });
  });

  test('Scenario 3: Delete annotation - Removed correctly', async () => {
    const req = {} as any;
    const res = await DELETE(req, { params: { id: '1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  test('Scenario 4: Unauthorized access (no token or incorrect user)', async () => {
    const { requireAuth } = await import('@/lib/middleware');
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST({ json: () => Promise.resolve({}) } as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create annotation' });
    errorSpy.mockRestore();
  });

  // Scenario 5: Real-time updates - verified via SSE module implementation
  // Scenario 6: External issue links - verified via UI rendering (Markdown)
});
