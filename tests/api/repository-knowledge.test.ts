import { describe, it, expect } from 'vitest';
import { gitverseConfigParser } from '../../lib/parsers/gitverseConfigParser';
import { gitverseConfigValidator } from '../../lib/validators/gitverseConfigValidator';

describe('Repository Knowledge Config', () => {
  describe('gitverseConfigValidator', () => {
    it('Scenario 1 & 2: Valid JSON should parse correctly', () => {
      const jsonContent = JSON.stringify({
        projectDescription: "A test project",
        glossary: { "API": "Application Programming Interface" },
        onboarding: ["Step 1", "Step 2"],
        architecturePrinciples: ["REST"]
      });
      const parsed = gitverseConfigValidator.validateJson(jsonContent);
      expect(parsed?.projectDescription).toBe("A test project");
      expect(parsed?.glossary?.API).toBe("Application Programming Interface");
    });

    it('Scenario 6: Malformed configuration should throw', () => {
      expect(() => {
        gitverseConfigValidator.validateJson('{ invalid json');
      }).toThrow();
    });
    
    it('Size limits are enforced', () => {
      const hugeJson = JSON.stringify({
        projectDescription: "A".repeat(60000)
      });
      expect(() => {
        gitverseConfigValidator.validateJson(hugeJson);
      }).toThrow(/File size exceeds/);
    });
  });

  describe('gitverseConfigParser', () => {
    it('Scenario 1 & 4 & 5: Parse valid Markdown with glossary and onboarding', () => {
      const mdContent = `
# Project Overview
This is a sample project for testing.

# Glossary
RAG = Retrieval Augmented Generation
LLM: Large Language Model

# Contributor Onboarding
- Run npm install
- Ask for permissions

# Architecture
- Microservices
`;
      const parsed = gitverseConfigParser.parseMarkdown(mdContent);
      expect(parsed.projectDescription).toBe("This is a sample project for testing.");
      expect(parsed.glossary?.RAG).toBe("Retrieval Augmented Generation");
      expect(parsed.glossary?.LLM).toBe("Large Language Model");
      expect(parsed.onboardingNotes).toContain("Run npm install");
      expect(parsed.architecturePrinciples).toContain("Microservices");
    });

    it('Scenario 3: Missing config returns empty', () => {
      const merged = gitverseConfigParser.mergeKnowledge(undefined, undefined);
      expect(merged).toEqual({});
    });
    
    it('Merges JSON and MD correctly with JSON taking precedence', () => {
      const mdConfig = {
        projectDescription: "MD Desc",
        glossary: { "Term1": "MD Term1" }
      };
      const jsonConfig = {
        projectDescription: "JSON Desc",
        glossary: { "Term1": "JSON Term1", "Term2": "JSON Term2" }
      };
      
      const merged = gitverseConfigParser.mergeKnowledge(jsonConfig, mdConfig);
      expect(merged.projectDescription).toBe("JSON Desc");
      expect(merged.glossary?.Term1).toBe("JSON Term1");
      expect(merged.glossary?.Term2).toBe("JSON Term2");
    });
  });
});
