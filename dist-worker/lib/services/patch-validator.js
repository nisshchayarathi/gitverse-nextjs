"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchValidatorService = void 0;
const self_healing_1 = require("../../types/self-healing");
const ts = __importStar(require("typescript"));
class PatchValidatorService {
    /**
     * Validates if the patch is safe to apply.
     * Checks confidence score and ensures the new code doesn't introduce syntax errors.
     */
    validatePatch(patch, originalContent) {
        const fullPatch = patch;
        if (fullPatch.confidenceScore < self_healing_1.SELF_HEAL_CONFIDENCE_THRESHOLD) {
            fullPatch.status = "low_confidence";
            return fullPatch;
        }
        // Attempt to parse the patched content if it's a TS/JS file
        if (fullPatch.file.endsWith(".ts") || fullPatch.file.endsWith(".tsx") || fullPatch.file.endsWith(".js") || fullPatch.file.endsWith(".jsx")) {
            const lines = originalContent.split("\n");
            const startLine = (fullPatch.startLine || fullPatch.endLine) - 1;
            const endLine = fullPatch.endLine - 1;
            const patchedLines = [
                ...lines.slice(0, startLine),
                fullPatch.suggestionBody,
                ...lines.slice(endLine + 1)
            ];
            const patchedContent = patchedLines.join("\n");
            // Basic syntax check using TS compiler API
            const sourceFile = ts.createSourceFile(fullPatch.file, patchedContent, ts.ScriptTarget.Latest, true);
            // Check for syntax errors
            const sfAny = sourceFile;
            const hasErrors = sfAny.parseDiagnostics && sfAny.parseDiagnostics.length > 0;
            if (hasErrors) {
                fullPatch.status = "invalid_syntax";
                return fullPatch;
            }
        }
        fullPatch.status = "valid";
        return fullPatch;
    }
}
exports.PatchValidatorService = PatchValidatorService;
