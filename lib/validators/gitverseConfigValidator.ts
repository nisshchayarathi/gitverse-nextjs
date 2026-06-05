export interface GitverseJsonConfig {
  projectDescription?: string;
  glossary?: Record<string, string>;
  onboarding?: string[];
  architecturePrinciples?: string[];
}

const MAX_FILE_SIZE = 50 * 1024; // 50KB

export const gitverseConfigValidator = {
  validateJson(content: string): GitverseJsonConfig | null {
    if (!content || content.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds the limit of ${MAX_FILE_SIZE} bytes or is empty`);
    }

    try {
      const parsed = JSON.parse(content);
      
      const config: GitverseJsonConfig = {};
      
      if (parsed.projectDescription !== undefined) {
        if (typeof parsed.projectDescription !== 'string') throw new Error("projectDescription must be a string");
        if (parsed.projectDescription.length > 2000) throw new Error("projectDescription is too long");
        config.projectDescription = parsed.projectDescription;
      }
      
      if (parsed.glossary !== undefined) {
        if (typeof parsed.glossary !== 'object' || parsed.glossary === null || Array.isArray(parsed.glossary)) {
          throw new Error("glossary must be an object");
        }
        for (const [key, value] of Object.entries(parsed.glossary)) {
          if (typeof key !== 'string' || key.length > 100) throw new Error("glossary key must be a string <= 100 chars");
          if (typeof value !== 'string' || value.length > 500) throw new Error("glossary value must be a string <= 500 chars");
        }
        config.glossary = parsed.glossary;
      }
      
      if (parsed.onboarding !== undefined) {
        if (!Array.isArray(parsed.onboarding)) throw new Error("onboarding must be an array");
        if (parsed.onboarding.length > 50) throw new Error("onboarding array is too long");
        for (const item of parsed.onboarding) {
          if (typeof item !== 'string' || item.length > 1000) throw new Error("onboarding item must be a string <= 1000 chars");
        }
        config.onboarding = parsed.onboarding;
      }
      
      if (parsed.architecturePrinciples !== undefined) {
        if (!Array.isArray(parsed.architecturePrinciples)) throw new Error("architecturePrinciples must be an array");
        if (parsed.architecturePrinciples.length > 50) throw new Error("architecturePrinciples array is too long");
        for (const item of parsed.architecturePrinciples) {
          if (typeof item !== 'string' || item.length > 1000) throw new Error("architecturePrinciples item must be a string <= 1000 chars");
        }
        config.architecturePrinciples = parsed.architecturePrinciples;
      }

      return config;
    } catch (e: any) {
      if (e.message.includes("JSON")) {
        throw new Error("Invalid JSON format");
      }
      throw new Error(`JSON Schema Validation Failed: ${e.message}`);
    }
  },

  validateMarkdownSize(content: string) {
    if (!content || content.length > MAX_FILE_SIZE) {
      throw new Error(`Markdown file size exceeds the limit of ${MAX_FILE_SIZE} bytes or is empty`);
    }
  }
};
