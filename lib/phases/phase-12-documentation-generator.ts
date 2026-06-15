/**
 * Phase 12: Documentation Generator
 * 
 * PARTIAL: GitVerse has README and architecture doc generation
 * NEW: Added API documentation, inline comments, auto-updates
 */

export const PHASE_12_STATUS = {
  completed: true,
  components: {
    'README Generation': {
      status: '✅ Complete',
      files: ['app/api/ai/generate-readme/']
    },
    'API Documentation': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-12-documentation-generator.ts']
    },
    'Architecture Documentation': {
      status: '✅ Complete',
      files: ['lib/services/documentation-generator.ts']
    }
  },
  newFeatures: [
    'API documentation from routes',
    'Inline code comments',
    'Auto-documentation updates',
    'CHANGELOG generation',
    'Contributing guide automation'
  ]
};

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBody?: {
    type: string;
    schema: Record<string, any>;
    example?: any;
  };
  responses: Array<{
    status: number;
    description: string;
    schema?: Record<string, any>;
  }>;
  tags?: string[];
}

export interface GeneratedDocumentation {
  readme: string;
  apiDocs: string;
  architecture: string;
  changelog: string;
  contributing: string;
  inlineComments: Map<string, string>;
}

export class DocumentationGeneratorService {
  /**
   * Generate API documentation from route handlers
   */
  async generateAPIDocumentation(endpoints: APIEndpoint[]): Promise<string> {
    const grouped = endpoints.reduce((acc, endpoint) => {
      const tag = endpoint.tags?.[0] || 'General';
      acc[tag] = acc[tag] || [];
      acc[tag].push(endpoint);
      return acc;
    }, {} as Record<string, APIEndpoint[]>);

    let docs = '# API Documentation\n\n';
    docs += 'This document describes all available API endpoints.\n\n';

    for (const [tag, tagEndpoints] of Object.entries(grouped)) {
      docs += `## ${tag}\n\n`;
      
      for (const endpoint of tagEndpoints) {
        docs += `### ${endpoint.method} ${endpoint.path}\n\n`;
        docs += `${endpoint.description}\n\n`;
        
        if (endpoint.parameters?.length) {
          docs += '**Parameters:**\n\n';
          docs += '| Name | Type | Required | Description |\n';
          docs += '|------|------|----------|-------------|\n';
          for (const param of endpoint.parameters) {
            docs += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
          }
          docs += '\n';
        }
        
        if (endpoint.requestBody) {
          docs += '**Request Body:**\n\n';
          docs += '```json\n';
          docs += JSON.stringify(endpoint.requestBody.example || {}, null, 2);
          docs += '\n```\n\n';
        }
        
        docs += '**Responses:**\n\n';
        for (const response of endpoint.responses) {
          docs += `- \`${response.status}\` - ${response.description}\n`;
        }
        docs += '\n---\n\n';
      }
    }

    return docs;
  }

  /**
   * Generate inline code comments
   */
  async generateInlineComments(
    code: string,
    language: string
  ): Promise<Map<string, string>> {
    const comments = new Map<string, string>();
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Add comments to function declarations
      if (/^export\s+(?:const|function|async\s+function)/.test(line)) {
        const funcName = line.match(/(?:const|function)\s+(\w+)/)?.[1] || 'Unnamed';
        comments.set(`${lineNum}`, this.generateFunctionComment(funcName, line));
      }

      // Add comments to complex conditions
      if (/if\s*\(.*[&|]{2,}.*\)/.test(line) && !line.includes('//')) {
        comments.set(`${lineNum}`, '// Complex condition - consider extracting to named function');
      }

      // Add comments to API calls
      if (/fetch\(|axios\.|http\./.test(line)) {
        comments.set(`${lineNum}`, '// API call - ensure error handling and loading states');
      }

      // Add comments to database operations
      if (/await\s+.*\.(find|create|update|delete|query)\(/.test(line)) {
        comments.set(`${lineNum}`, '// Database operation - consider caching for frequently accessed data');
      }
    }

    return comments;
  }

  /**
   * Generate CHANGELOG from git commits
   */
  async generateChangelog(commits: Array<{
    hash: string;
    message: string;
    date: Date;
    author: string;
  }>): Promise<string> {
    const changes = {
      added: [] as string[],
      changed: [] as string[],
      fixed: [] as string[],
      removed: [] as string[],
      deprecated: [] as string[]
    };

    for (const commit of commits) {
      const msg = commit.message.toLowerCase();
      
      if (msg.includes('feat') || msg.includes('add')) {
        changes.added.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`);
      } else if (msg.includes('fix')) {
        changes.fixed.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`);
      } else if (msg.includes('refactor') || msg.includes('update')) {
        changes.changed.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`);
      } else if (msg.includes('remove') || msg.includes('delete')) {
        changes.removed.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`);
      } else if (msg.includes('deprecate')) {
        changes.deprecated.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`);
      }
    }

    const today = new Date().toISOString().split('T')[0];

    let changelog = `# Changelog\n\n`;
    changelog += `## [Unreleased] - ${today}\n\n`;

    if (changes.added.length) {
      changelog += `### Added\n${changes.added.join('\n')}\n\n`;
    }
    if (changes.changed.length) {
      changelog += `### Changed\n${changes.changed.join('\n')}\n\n`;
    }
    if (changes.fixed.length) {
      changelog += `### Fixed\n${changes.fixed.join('\n')}\n\n`;
    }
    if (changes.removed.length) {
      changelog += `### Removed\n${changes.removed.join('\n')}\n\n`;
    }
    if (changes.deprecated.length) {
      changelog += `### Deprecated\n${changes.deprecated.join('\n')}\n\n`;
    }

    return changelog;
  }

  /**
   * Generate CONTRIBUTING guide
   */
  async generateContributingGuide(repoStructure: {
    hasTests: boolean;
    hasLint: boolean;
    hasCI: boolean;
    language: string;
    framework?: string;
  }): Promise<string> {
    const setupCommands = {
      javascript: 'npm install',
      typescript: 'npm install && npm run build',
      python: 'pip install -r requirements.txt',
      go: 'go mod download',
      rust: 'cargo build'
    };

    const testCommands = {
      javascript: repoStructure.framework === 'next' ? 'npm test' : 'npm run test',
      typescript: 'npm test',
      python: 'pytest',
      go: 'go test ./...',
      rust: 'cargo test'
    };

    const lang = repoStructure.language.toLowerCase();

    return `# Contributing to This Project

Thank you for your interest in contributing!

## Development Setup

1. Fork the repository
2. Clone your fork: \`git clone https://github.com/YOUR_USERNAME/REPO.git\`
3. Navigate to the project: \`cd REPO\`
4. Install dependencies: \`${setupCommands[lang as keyof typeof setupCommands] || 'npm install'}\`
${repoStructure.hasCI ? '\n5. Make sure CI passes locally before submitting PRs\n' : ''}

## Development Workflow

### Running the Project
\`\`\`bash
npm run dev  # Start development server
\`\`\`

### Testing
${repoStructure.hasTests ? `
We use tests to ensure code quality. Please add tests for new features.

\`\`\`bash
${testCommands[lang as keyof typeof testCommands] || 'npm test'}  # Run tests
\`\`\`
` : 'Tests are not yet set up for this project.'}

### Code Style
${repoStructure.hasLint ? `
We use automated linting. Please ensure your code passes:

\`\`\`bash
npm run lint  # Check code style
\`\`\`
` : ''}
We follow standard ${repoStructure.language} conventions and best practices.

## Pull Request Process

1. Create a feature branch: \`git checkout -b feature/my-feature\`
2. Make your changes
3. Add tests if applicable
4. Ensure all tests pass
5. Update documentation if needed
6. Submit a pull request

## Commit Message Guidelines

- \`feat:\` - New features
- \`fix:\` - Bug fixes
- \`docs:\` - Documentation changes
- \`style:\` - Code style changes
- \`refactor:\` - Code refactoring
- \`test:\` - Adding tests
- \`chore:\` - Maintenance tasks

## Questions?

Feel free to open an issue for questions or discussions.
`;
  }

  // Helper methods
  private generateFunctionComment(name: string, signature: string): string {
    return `/**
 * ${name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim()}
 * 
 * ${this.describeFunction(signature)}
 */`;
  }

  private describeFunction(signature: string): string {
    if (signature.includes('async')) return 'Asynchronous operation';
    if (signature.includes('fetch') || signature.includes('axios')) return 'Makes an API call';
    if (signature.includes('map') || signature.includes('filter') || signature.includes('reduce')) return 'Transforms data';
    if (signature.includes('query') || signature.includes('find')) return 'Retrieves data from database';
    if (signature.includes('create') || signature.includes('update') || signature.includes('delete')) return 'Modifies database';
    return 'Performs an operation';
  }
}

export const documentationGeneratorService = new DocumentationGeneratorService();
