import { describe, it, expect, vi } from 'vitest';
import { ConcurrencyLimiter } from '../lib/utils/concurrencyLimiter';
import { withDbRetry } from '../lib/utils/dbRetry';

describe('Concurrency Control', () => {
  it('ConcurrencyLimiter should limit active jobs', async () => {
    const limiter = new ConcurrencyLimiter('TestLimiter', 2);
    
    let active = 0;
    let maxActive = 0;
    
    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 50));
      active--;
    };

    const promises = Array.from({ length: 10 }).map(() => limiter.add(task));
    
    expect(limiter.getStatus().queued).toBeGreaterThan(0);
    
    await Promise.all(promises);
    
    expect(maxActive).toBe(2);
    expect(limiter.getStatus().active).toBe(0);
    expect(limiter.getStatus().queued).toBe(0);
  });

  it('withDbRetry should retry on transient errors and succeed', async () => {
    let attempts = 0;
    const task = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw { code: 'P2024', message: 'Connection pool timeout' };
      }
      return 'success';
    });

    const result = await withDbRetry(task, 3, 10);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('withDbRetry should throw on non-transient errors', async () => {
    const task = vi.fn().mockImplementation(async () => {
      throw new Error('Some fatal error');
    });

    await expect(withDbRetry(task, 3, 10)).rejects.toThrow('Some fatal error');
  });

  it('withDbRetry should throw if max retries exceeded', async () => {
    const task = vi.fn().mockImplementation(async () => {
      throw { code: 'P2024', message: 'Connection pool timeout' };
    });

    await expect(withDbRetry(task, 3, 10)).rejects.toHaveProperty('code', 'P2024');
  });
});
