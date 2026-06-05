import { gitverseConfigValidator, GitverseJsonConfig } from '../validators/gitverseConfigValidator';

export interface ParsedRepositoryKnowledge {
  projectDescription?: string;
  glossary?: Record<string, string>;
  onboardingNotes?: string[];
  architecturePrinciples?: string[];
}

export const gitverseConfigParser = {
  parseJson(content: string): ParsedRepositoryKnowledge {
    const config = gitverseConfigValidator.validateJson(content);
    if (!config) return {};

    return {
      projectDescription: config.projectDescription,
      glossary: config.glossary,
      onboardingNotes: config.onboarding,
      architecturePrinciples: config.architecturePrinciples
    };
  },

  parseMarkdown(content: string): ParsedRepositoryKnowledge {
    gitverseConfigValidator.validateMarkdownSize(content);

    const lines = content.split('\n');
    let currentSection = '';
    
    const knowledge: ParsedRepositoryKnowledge = {
      projectDescription: '',
      glossary: {},
      onboardingNotes: [],
      architecturePrinciples: []
    };

    let projectDescLines: string[] = [];
    
    for (const line of lines) {
      if (line.match(/^#+\s+(.*)/)) {
        const heading = line.replace(/^#+\s+/, '').toLowerCase().trim();
        if (heading.includes('project overview') || heading.includes('description')) {
          currentSection = 'overview';
        } else if (heading.includes('glossary')) {
          currentSection = 'glossary';
        } else if (heading.includes('contributor') || heading.includes('onboarding')) {
          currentSection = 'onboarding';
        } else if (heading.includes('architectur')) {
          currentSection = 'architecture';
        } else {
          currentSection = '';
        }
        continue;
      }

      if (!line.trim()) continue;

      switch (currentSection) {
        case 'overview':
          projectDescLines.push(line.trim());
          break;
        case 'glossary':
          // Match lines like: "RAG = Retrieval Augmented Generation" or "RAG: Retrieval..."
          const match = line.match(/^([^=:]+)[=:]\s*(.*)$/);
          if (match && knowledge.glossary) {
            knowledge.glossary[match[1].trim()] = match[2].trim();
          }
          break;
        case 'onboarding':
          knowledge.onboardingNotes?.push(line.replace(/^[-*]\s*/, '').trim());
          break;
        case 'architecture':
          knowledge.architecturePrinciples?.push(line.replace(/^[-*]\s*/, '').trim());
          break;
      }
    }

    if (projectDescLines.length > 0) {
      knowledge.projectDescription = projectDescLines.join(' ');
    }

    return knowledge;
  },

  mergeKnowledge(jsonConfig?: ParsedRepositoryKnowledge, mdConfig?: ParsedRepositoryKnowledge): ParsedRepositoryKnowledge {
    const merged: ParsedRepositoryKnowledge = {};
    
    // JSON takes precedence if both are present
    merged.projectDescription = jsonConfig?.projectDescription || mdConfig?.projectDescription;
    
    merged.glossary = { ...(mdConfig?.glossary || {}), ...(jsonConfig?.glossary || {}) };
    if (Object.keys(merged.glossary).length === 0) merged.glossary = undefined;

    merged.onboardingNotes = jsonConfig?.onboardingNotes?.length ? jsonConfig.onboardingNotes : mdConfig?.onboardingNotes;
    if (merged.onboardingNotes?.length === 0) merged.onboardingNotes = undefined;

    merged.architecturePrinciples = jsonConfig?.architecturePrinciples?.length ? jsonConfig.architecturePrinciples : mdConfig?.architecturePrinciples;
    if (merged.architecturePrinciples?.length === 0) merged.architecturePrinciples = undefined;

    return merged;
  }
};
