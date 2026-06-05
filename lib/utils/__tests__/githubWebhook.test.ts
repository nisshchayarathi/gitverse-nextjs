import crypto from 'crypto';
import { verifyGitHubWebhookSignature } from '../githubWebhook';

describe('verifyGitHubWebhookSignature', () => {
  const secret = 'webhook-secret-key-123';
  const payload = JSON.stringify({ event: 'ping', zen: 'Keep it simple' });

  const makeSignature = (body: string, key: string) => {
    return 'sha256=' + crypto.createHmac('sha256', key).update(body).digest('hex');
  };

  it('returns true for correct signature and payload', () => {
    const signature = makeSignature(payload, secret);
    const result = verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: signature,
      webhookSecret: secret,
    });
    expect(result).toBe(true);
  });

  it('returns false if webhookSecret is empty or blank', () => {
    const signature = makeSignature(payload, secret);
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: signature,
      webhookSecret: '',
    })).toBe(false);
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: signature,
      webhookSecret: '  ',
    })).toBe(false);
  });

  it('returns false if signature256Header is missing or does not start with sha256=', () => {
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: null,
      webhookSecret: secret,
    })).toBe(false);
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: 'bad-format-sig',
      webhookSecret: secret,
    })).toBe(false);
  });

  it('returns false if signature or payload is mismatched', () => {
    const signature = makeSignature(payload, secret);
    
    // Mismatched body
    expect(verifyGitHubWebhookSignature({
      rawBody: payload + ' extra data',
      signature256Header: signature,
      webhookSecret: secret,
    })).toBe(false);

    // Mismatched secret
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: signature,
      webhookSecret: 'different-secret',
    })).toBe(false);

    // Mismatched signature header length
    expect(verifyGitHubWebhookSignature({
      rawBody: payload,
      signature256Header: signature + 'a',
      webhookSecret: secret,
    })).toBe(false);
  });
});
