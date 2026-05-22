"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGitHubWebhookSignature = verifyGitHubWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
function verifyGitHubWebhookSignature(params) {
    const { rawBody, signature256Header, webhookSecret } = params;
    if (!webhookSecret?.trim())
        return false;
    if (!signature256Header?.startsWith("sha256="))
        return false;
    const expected = "sha256=" +
        crypto_1.default.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    try {
        // timingSafeEqual requires same-length buffers
        const a = Buffer.from(expected);
        const b = Buffer.from(signature256Header);
        if (a.length !== b.length)
            return false;
        return crypto_1.default.timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
