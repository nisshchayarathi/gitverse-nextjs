"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
exports.isTokenEncrypted = isTokenEncrypted;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
function getEncryptionKey() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
        throw new Error("TOKEN_ENCRYPTION_KEY is required for token encryption");
    }
    return Buffer.from(key, "hex");
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
