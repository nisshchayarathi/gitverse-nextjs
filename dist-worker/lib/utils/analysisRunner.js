"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnalysisRunnerAuthorized = isAnalysisRunnerAuthorized;
exports.shouldThrottleJobKick = shouldThrottleJobKick;
exports.registerUnhandledRejectionLogger = registerUnhandledRejectionLogger;
const crypto_1 = __importDefault(require("crypto"));

function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto_1.default.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto_1.default.timingSafeEqual(bufA, bufB);
}

function getRequiredSecret() {
    const secret = process.env.ANALYSIS_RUNNER_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            console.error(
                "[AnalysisRunner] ANALYSIS_RUNNER_SECRET is not set. " +
                "The endpoint will reject all requests until it is configured."
            );
        }
        return "";
    }
    return secret;
}

function isAnalysisRunnerAuthorized(request) {
    const configuredSecret = getRequiredSecret();
    if (!configuredSecret) {
        return false;
    }
    const headerSecret = request.headers.get("x-analysis-runner-secret");
    if (headerSecret && timingSafeCompare(headerSecret, configuredSecret)) {
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

const lastKickAtByJobId = new Map();

function registerUnhandledRejectionLogger() {
    if (globalThis.__analysisRunnerUnhandledRegistered) {
        return;
    }
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled rejection in analysis runner:", reason);
    });
    globalThis.__analysisRunnerUnhandledRegistered = true;
}
