"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEphemeralSecret = getEphemeralSecret;
exports.isAnalysisRunnerAuthorized = isAnalysisRunnerAuthorized;
exports.shouldThrottleJobKick = shouldThrottleJobKick;
exports.registerUnhandledRejectionLogger = registerUnhandledRejectionLogger;
const crypto_1 = __importDefault(require("crypto"));
const lastKickAtByJobId = new Map();
const EPHEMERAL_SECRET = !process.env.ANALYSIS_RUNNER_SECRET
    ? crypto_1.default.randomBytes(32).toString("hex")
    : undefined;
function getEphemeralSecret() {
    return EPHEMERAL_SECRET;
}
function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto_1.default.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto_1.default.timingSafeEqual(bufA, bufB);
}
function isAnalysisRunnerAuthorized(request) {
    const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET || EPHEMERAL_SECRET;
    if (!configuredSecret) {
        return false;
    }
    const headerSecret = request.headers.get("x-analysis-runner-secret");
    if (headerSecret && timingSafeCompare(headerSecret, configuredSecret)) {
        return true;
    }
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    if (querySecret && timingSafeCompare(querySecret, configuredSecret)) {
        return true;
    }
    return false;
}
function shouldThrottleJobKick(jobId) {
    const now = Date.now();
    const lastKickAt = lastKickAtByJobId.get(jobId) ?? 0;
    if (now - lastKickAt < 5000) {
        return true;
    }
    lastKickAtByJobId.set(jobId, now);
    return false;
}
function registerUnhandledRejectionLogger() {
    if (globalThis.__analysisRunnerUnhandledRegistered) {
        return;
    }
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled rejection in analysis runner:", reason);
    });
    globalThis.__analysisRunnerUnhandledRegistered = true;
}
