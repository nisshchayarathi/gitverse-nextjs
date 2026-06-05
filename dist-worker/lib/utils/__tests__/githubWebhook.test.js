"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const githubWebhook_1 = require("../githubWebhook");
describe('verifyGitHubWebhookSignature', () => {
    const secret = 'webhook-secret-key-123';
    const payload = JSON.stringify({ event: 'ping', zen: 'Keep it simple' });
    const makeSignature = (body, key) => {
        return 'sha256=' + crypto_1.default.createHmac('sha256', key).update(body).digest('hex');
    };
    it('returns true for correct signature and payload', () => {
        const signature = makeSignature(payload, secret);
        const result = (0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: signature,
            webhookSecret: secret,
        });
        expect(result).toBe(true);
    });
    it('returns false if webhookSecret is empty or blank', () => {
        const signature = makeSignature(payload, secret);
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: signature,
            webhookSecret: '',
        })).toBe(false);
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: signature,
            webhookSecret: '  ',
        })).toBe(false);
    });
    it('returns false if signature256Header is missing or does not start with sha256=', () => {
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: null,
            webhookSecret: secret,
        })).toBe(false);
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: 'bad-format-sig',
            webhookSecret: secret,
        })).toBe(false);
    });
    it('returns false if signature or payload is mismatched', () => {
        const signature = makeSignature(payload, secret);
        // Mismatched body
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload + ' extra data',
            signature256Header: signature,
            webhookSecret: secret,
        })).toBe(false);
        // Mismatched secret
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: signature,
            webhookSecret: 'different-secret',
        })).toBe(false);
        // Mismatched signature header length
        expect((0, githubWebhook_1.verifyGitHubWebhookSignature)({
            rawBody: payload,
            signature256Header: signature + 'a',
            webhookSecret: secret,
        })).toBe(false);
    });
});
