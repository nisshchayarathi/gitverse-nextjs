"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAIProvider = void 0;
class ClientAIProvider {
    static async generateModuleSummary(provider, apiKey, context) {
        // This is a client-side AI helper. Actual implementation would call an AI API.
        return {
            summary: `Module ${context.moduleName} contains ${context.files.length} files.`,
        };
    }
}
exports.ClientAIProvider = ClientAIProvider;
