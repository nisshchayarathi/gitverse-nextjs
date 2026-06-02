import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getJwtSecret, getNextAuthSecret } from '../lib/config/env';

describe('Environment Secret Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return process.env.JWT_SECRET if present', () => {
    process.env.JWT_SECRET = 'my-custom-jwt-secret';
    expect(getJwtSecret()).toBe('my-custom-jwt-secret');
  });

  it('should return process.env.NEXTAUTH_SECRET if present', () => {
    process.env.NEXTAUTH_SECRET = 'my-custom-nextauth-secret';
    expect(getNextAuthSecret()).toBe('my-custom-nextauth-secret');
  });

  it('should fallback to development secret if NODE_ENV !== production', () => {
    delete process.env.JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = 'development';
    
    expect(getJwtSecret()).toBe('development-jwt-secret');
    expect(getNextAuthSecret()).toBe('development-nextauth-secret');
  });

  it('should throw an error in production if secret is missing', () => {
    delete process.env.JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = 'production';
    
    expect(() => getJwtSecret()).toThrow('Internal Server Error: Missing required security configuration.');
    expect(() => getNextAuthSecret()).toThrow('Internal Server Error: Missing required security configuration.');
  });
});
