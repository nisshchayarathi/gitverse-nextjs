export interface AIContext {
  moduleName: string;
  files: { path: string; size: number }[];
}

export class ClientAIProvider {
  static async generateModuleSummary(
    provider: string,
    apiKey: string,
    context: AIContext
  ): Promise<{ summary: string }> {
    // This is a client-side AI helper. Actual implementation would call an AI API.
    return {
      summary: `Module ${context.moduleName} contains ${context.files.length} files.`,
    };
  }
}
