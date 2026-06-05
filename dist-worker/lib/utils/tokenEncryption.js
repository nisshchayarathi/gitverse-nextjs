"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEncryptionHealth = checkEncryptionHealth;
exports.validateEncryptionConfig = validateEncryptionConfig;
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
exports.isTokenEncrypted = isTokenEncrypted;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_BYTE_LENGTH = 32;
const KEY_HEX_LENGTH = KEY_BYTE_LENGTH * 2;
const HEX_REGEX = /^[0-9a-f]+$/i;
function getEncryptionKey() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
        throw new Error("TOKEN_ENCRYPTION_KEY is required for token encryption");
    }
    const trimmed = key.trim();
    if (trimmed.length !== KEY_HEX_LENGTH) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be " + KEY_HEX_LENGTH + " hex characters (" + KEY_BYTE_LENGTH + " bytes); got " + trimmed.length + " characters");
    }
    if (!HEX_REGEX.test(trimmed)) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be a hexadecimal string (0-9, a-f)");
    }
    return Buffer.from(trimmed, "hex");
}
function validateEncryptionConfig() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key || !key.trim()) {
        return { valid: false, error: "TOKEN_ENCRYPTION_KEY is not set" };
    }
    const trimmed = key.trim();
    if (trimmed.length !== KEY_HEX_LENGTH) {
        return {
            valid: false,
            error: "TOKEN_ENCRYPTION_KEY must be " + KEY_HEX_LENGTH + " hex characters; got " + trimmed.length,
        };
    }
    if (!HEX_REGEX.test(trimmed)) {
        return {
            valid: false,
            error: "TOKEN_ENCRYPTION_KEY must be a hex string (0-9, a-f)",
        };
    }
    return { valid: true };
}
function checkEncryptionHealth() {
    const config = validateEncryptionConfig();
    if (!config.valid) {
        return { healthy: false, message: config.error };
    }
    try {
        const testPayload = "health-check-test-payload";
        const encrypted = encryptToken(testPayload);
        const decrypted = decryptToken(encrypted);
        if (decrypted !== testPayload) {
            return { healthy: false, message: "Encrypt/decrypt round-trip failed" };
        }
        return { healthy: true, message: "Encryption is properly configured" };
    }
    catch (e) {
        return { healthy: false, message: "Encryption check failed: " + e.message };
    }
}
function encryptToken(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
function decryptToken(ciphertext) {
    const key = getEncryptionKey();
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
}
function isTokenEncrypted(value) {
    try {
        const buf = Buffer.from(value, "base64");
        return buf.length > IV_LENGTH + TAG_LENGTH;
    }
    catch {
        return false;
    }
}
