import { createSignedState, verifySignedState } from '../signedState';

describe('signedState', () => {
  const originalSecret = process.env.GITHUB_APP_STATE_SECRET;
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(() => {
    process.env.GITHUB_APP_STATE_SECRET = 'test-secret-key-123456';
  });

  afterAll(() => {
    process.env.GITHUB_APP_STATE_SECRET = originalSecret;
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  });

  it('creates and verifies signed states correctly', () => {
    const payload = { userId: '123', org: 'test-org' };
    const signed = createSignedState(payload);

    expect(signed).toContain('.');

    const result = verifySignedState<typeof payload>(signed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(payload);
    }
  });

  it('fails verification if state has incorrect format', () => {
    expect(verifySignedState('invalidstate')).toEqual({ ok: false, error: 'missing_state' });
    expect(verifySignedState('a.')).toEqual({ ok: false, error: 'bad_state' });
  });

  it('fails verification if signature is incorrect or signature is modified', () => {
    const payload = { userId: '123' };
    const signed = createSignedState(payload);

    // Modify signature part while keeping the same length
    const [body, sigStr] = signed.split('.');

    // Decode signature string to Buffer
    const sigBuf = Buffer.from(
      sigStr.replace(/-/g, '+').replace(/_/g, '/') +
      '==='.slice((sigStr.length + 3) % 4),
      'base64'
    );

    // Mutate the first byte
    sigBuf[0] = sigBuf[0] ^ 1;

    // Re-encode to base64url
    const badSigStr = sigBuf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    const badSigned = `${body}.${badSigStr}`;

    expect(verifySignedState(badSigned)).toEqual({ ok: false, error: 'invalid_signature' });
  });

  it('fails verification if GITHUB_APP_STATE_SECRET is not configured', () => {
    const prevSecret = process.env.GITHUB_APP_STATE_SECRET;
    const prevNextAuthSecret = process.env.NEXTAUTH_SECRET;
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.GITHUB_APP_STATE_SECRET = '';
      process.env.NEXTAUTH_SECRET = '';
      (process.env as any).NODE_ENV = 'production';

      expect(() => createSignedState({ a: 1 })).toThrow();
    } finally {
      process.env.GITHUB_APP_STATE_SECRET = prevSecret;
      process.env.NEXTAUTH_SECRET = prevNextAuthSecret;
      (process.env as any).NODE_ENV = prevNodeEnv;
    }
  });
});
