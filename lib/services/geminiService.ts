import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { getGeminiAnalysisCache, setGeminiAnalysisCache } from "./geminiAnalysisCacheService";
import { buildCacheKey } from "../utils/cacheKey";

const CURRENT_MODEL_VERSION = "gemini-2.5-flash";

const HIGH_CONFIDENCE_SECRETS = [
  { name: 'GitHub Token', pattern: /(?:gh[pousr]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/ },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/ },
  { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/ },
];

const SUSPECTED_SECRETS = [
  { name: 'Generic Secret', pattern: /(?:secret|key|token|password|passwd|pwd)[\s:=]+['"]?([a-zA-Z0-9\-_=]{16,})['"]?/gi },
  { name: 'Bearer Token', pattern: /bearer\s+([a-zA-Z0-9\-\._~+\/]+=*)/gi }
];

export function scanAndRedactPayload(payload: string): string {
  // 1. Check for high-confidence secrets
  for (const rule of HIGH_CONFIDENCE_SECRETS) {
    if (rule.pattern.test(payload)) {
      throw new Error(`High-confidence secret detected: ${rule.name}. Halting PR review to prevent secret leak to AI provider.`);
    }
  }

  // 2. Redact suspected tokens
  let redactedPayload = payload;
  for (const rule of SUSPECTED_SECRETS) {
    redactedPayload = redactedPayload.replace(rule.pattern, (match, secretToken) => {
      return match.replace(secretToken, '[REDACTED_SECRET]');
    });
  }

  return redactedPayload;
}

export interface AIAnalysisRequest {
  repositoryId: number;
  type:
  | "overview"
  | "code-quality"
  | "security"
  | "architecture"
  | "suggestions"
  | "architecture-document"
  | "architecture-chunk";
  context?: {
    files?: Array<{ path: string; content: string }>;
    fileTree?: string;
    commits?: Array<{ message: string; author: string; date: string }>;
    languages?: Array<{ name: string; percentage: number }>;
    contributors?: Array<{ name: string; commits: number }>;
    knowledge?: {
      projectDescription?: string;
      glossary?: Record<string, string>;
      onboardingNotes?: string[];
      architecturePrinciples?: string[];
    };
  };
}

export interface AICodeAnalysisRequest {
  code: string;
  language: string;
  analysisType: "explain" | "improve" | "bugs" | "document" | "refactor";
  context?: string;
  repositoryId?: number;
  commitHash?: string;
}

export interface AIRepositoryChatRequest {
  repositoryId: number;
  question: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    files?: string[];
    recentCommits?: string[];
    contributors?: string[];
    knowledge?: {
      projectDescription?: string;
      glossary?: Record<string, string>;
      onboardingNotes?: string[];
      architecturePrinciples?: string[];
    };
  };
}

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || "dummy-key-for-build";
    if (!key || key === "dummy-key-for-build") {
      // Defer throwing to runtime if possible, or warn. For now, use a dummy key during init.
    }
    
    this.client = new GoogleGenerativeAI(key);
    this.model = this.client.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  /**
   * Analyze repository and provide insights
   */
  async analyzeRepository(request: AIAnalysisRequest): Promise<string> {
    const { type, context } = request;

    let prompt = this.buildRepositoryAnalysisPrompt(type, context);
    prompt = scanAndRedactPayload(prompt);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini analysis error:", error);

      const message = error?.message?.toLowerCase() || "";

      if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("429")
      ) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
      
      if (
        message.includes("400 bad request") || 
        message.includes("token limit") || 
        message.includes("maximum context length") ||
        message.includes("too large") ||
        error?.status === 400
      ) {
        throw new Error("Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.");
      }

      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze code snippet
   */
  async analyzeCode(request: AICodeAnalysisRequest): Promise<string> {
    const { code, language, analysisType, context, repositoryId, commitHash } = request;

    let prompt = this.buildCodeAnalysisPrompt(
      code,
      language,
      analysisType,
      context,
    );
    prompt = scanAndRedactPayload(prompt);
    
    let cacheKey: ReturnType<typeof buildCacheKey> | null = null;
    if (repositoryId && commitHash) {
      cacheKey = buildCacheKey({
        repositoryId,
        commitHash,
        analysisType: `code-${analysisType}`,
        modelVersion: CURRENT_MODEL_VERSION,
        analysisScope: "full",
        context: { code, language, analysisType, context },
      });
      const cached = await getGeminiAnalysisCache(cacheKey);
      if (cached.hit && cached.result) {
        return cached.result;
      }
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (cacheKey) {
        await setGeminiAnalysisCache(cacheKey, text);
      }

      return text;
    } catch (error: any) {
      console.error("Gemini analysis error:", error);

      const message = error?.message?.toLowerCase() || "";

      if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("429")
      ) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
      
      if (
        message.includes("400 bad request") || 
        message.includes("token limit") || 
        message.includes("maximum context length") ||
        message.includes("too large") ||
        error?.status === 400
      ) {
        throw new Error("Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.");
      }

      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Chat about repository (Q&A)
   */
  async chatAboutRepository(request: AIRepositoryChatRequest): Promise<string> {
    const { question, conversationHistory, context } = request;

    let prompt = this.buildRepositoryChatPrompt(
      question,
      conversationHistory,
      context,
    );
    prompt = scanAndRedactPayload(prompt);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini chat error:", error);

      const message = error?.message?.toLowerCase() || "";

      if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("429")
      ) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
      
      if (
        message.includes("400 bad request") || 
        message.includes("token limit") || 
        message.includes("maximum context length") ||
        message.includes("too large") ||
        error?.status === 400
      ) {
        throw new Error("Context is too large for AI chat. Please try again with a smaller scope.");
      }

      throw new Error(`AI chat failed: ${error.message}`);
    }
  }

  /**
   * Chat using a pre-built prompt (free-form)
   */
  async chatRaw(
    prompt: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<{ text: string; tokensConsumed: number }> {
    if (!prompt?.trim()) {
      throw new Error("Prompt is required");
    }

    try {
      if (history && history.length > 0) {
        // Cap history to prevent context limit failures
        const MAX_HISTORY_LENGTH = 10;
        const recentHistory = history.slice(-MAX_HISTORY_LENGTH);

        const contents = [
          ...recentHistory.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: scanAndRedactPayload(msg.content) }],
          })),
          { role: "user", parts: [{ text: scanAndRedactPayload(prompt) }] },
        ];

        const result = await this.model.generateContent({ contents });
        const response = await result.response;
        const text = response.text();
        const tokensConsumed = response.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + text.length) / 4);
        return { text, tokensConsumed };
      } else {
        const result = await this.model.generateContent(scanAndRedactPayload(prompt));
        const response = await result.response;
        const text = response.text();
        const tokensConsumed = response.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + text.length) / 4);
        return { text, tokensConsumed };
      }
    } catch (error: any) {
      console.error("Gemini chat error:", error);

      const message = error?.message?.toLowerCase() || "";

      if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("429")
      ) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }

      if (
        message.includes("400 bad request") || 
        message.includes("token limit") || 
        message.includes("maximum context length") ||
        message.includes("too large") ||
        error?.status === 400
      ) {
        throw new Error("Prompt is too large for AI context limit. Please try again with a smaller scope.");
      }

      throw new Error(`AI chat failed: ${error.message}`);
    }
  }

  /**
   * Generate commit message suggestions
   */
  async suggestCommitMessage(changes: {
    added: string[];
    modified: string[];
    deleted: string[];
    diff?: string;
  }): Promise<string[]> {
    // Truncate diff to fit safely within context limits (approx 100k chars ~ 25k tokens)
    const MAX_DIFF_LENGTH = 100000;
    const safeDiff = changes.diff 
      ? (changes.diff.length > MAX_DIFF_LENGTH ? changes.diff.substring(0, MAX_DIFF_LENGTH) + "\n...[Diff truncated]" : changes.diff)
      : "";

    let prompt = `
Generate 3 conventional commit messages for the following code changes:

Added files: ${changes.added.join(", ") || "none"}
Modified files: ${changes.modified.join(", ") || "none"}
Deleted files: ${changes.deleted.join(", ") || "none"}

${safeDiff ? `Diff:\n${safeDiff}` : ""}

Format: type(scope): subject
Examples: feat(auth): add login endpoint, fix(ui): resolve button alignment

Provide only the commit messages, one per line.
`;
    prompt = scanAndRedactPayload(prompt);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text
        .split("\n")
        .filter((line) => line.trim())
        .slice(0, 3);
    } catch (error: any) {
      console.error("Commit message suggestion error:", error);

      throw new Error(
        error?.message || "Failed to generate commit message suggestions"
      );
    }
  }

  /**
   * Build repository analysis prompt
   */
  private buildRepositoryAnalysisPrompt(
    type: string,
    context?: AIAnalysisRequest["context"],
  ): string {
    const baseContext = `
Repository Context:
- Languages: ${context?.languages?.map((l) => `${l.name} (${l.percentage}%)`).join(", ") || "Unknown"}
- Contributors: ${context?.contributors?.length || 0}
- Recent commits: ${context?.commits?.length || 0}
${context?.fileTree ? `\nFile Structure:\n${context.fileTree}\n` : ""}`;

    let knowledgeContext = "";
    if (context?.knowledge) {
      knowledgeContext += `\nMaintainer Context (Highest Priority):\n`;
      if (context.knowledge.projectDescription) {
        knowledgeContext += `Project Description: ${context.knowledge.projectDescription}\n`;
      }
      if (context.knowledge.architecturePrinciples?.length) {
        knowledgeContext += `Architecture Principles:\n- ${context.knowledge.architecturePrinciples.join('\n- ')}\n`;
      }
      if (context.knowledge.glossary && Object.keys(context.knowledge.glossary).length > 0) {
        knowledgeContext += `Glossary:\n`;
        Object.entries(context.knowledge.glossary).forEach(([k, v]) => {
          knowledgeContext += `- ${k}: ${v}\n`;
        });
      }
      if (context.knowledge.onboardingNotes?.length) {
        knowledgeContext += `Onboarding Notes:\n- ${context.knowledge.onboardingNotes.join('\n- ')}\n`;
      }
    }
    
    const scopeNote = (context as any)?.targetDirectory
      ? `\nImportant: Restrict your analysis to the target directory (${(context as any).targetDirectory}). Only reference files outside this directory if they are immediately required dependencies.\n`
      : "";

    const fullContext = `${knowledgeContext}${baseContext}${scopeNote}`;

    switch (type) {
      case "overview":
        return `${fullContext}

Provide a comprehensive overview of this repository including:
1. Primary purpose and functionality
2. Technology stack analysis
3. Project maturity and activity level
4. Key strengths and areas for improvement

Be concise but informative.`;

      case "code-quality":
        return `${fullContext}

Analyze the code quality of this repository:
1. Code organization and structure
2. Naming conventions and consistency
3. Documentation quality
4. Testing coverage indicators
5. Specific recommendations for improvement

Provide actionable insights.`;

      case "security":
        return `${fullContext}

Perform a security analysis:
1. Potential security vulnerabilities
2. Dependencies that may need updates
3. Authentication and authorization patterns
4. Data handling practices
5. Security best practices recommendations`;

      case "architecture":
        return `${fullContext}

Analyze the software architecture:
1. Overall architecture pattern (MVC, microservices, etc.)
2. Component organization
3. Data flow and dependencies
4. Scalability considerations
5. Architectural recommendations`;

      case "suggestions":
        return `${fullContext}

Provide improvement suggestions:
1. Code refactoring opportunities
2. Performance optimization ideas
3. Feature enhancement suggestions
4. Development workflow improvements
5. Technology upgrade recommendations

Prioritize by impact and effort.`;

      case "architecture-document":
        return `${baseContext}${scopeNote}

You are an expert software architect analyzing an established codebase. Based on the provided repository context, generate a comprehensive ARCHITECTURE.md file. Use Markdown formatting. Ensure your response is strictly the Markdown content.

# Architecture Overview
[Provide a high level summary of the application's core functionality and its primary architectural pattern.]

## Core Modules
[Based on the file structure, identify 3-5 of the most crucial modules/components. Describe their primary responsibilities.]

## Dependencies
[Identify primary external dependencies, runtimes, and frameworks based on the context. Explain their role within the stack.]

## Data Flow
[Conceptually map how data traverses the application between the recognized components.]

## Risks
[List potential technical debt, scalability bottlenecks, or security concerns given the tech stack and complexity.]

## Contributor Notes
[Provide guidelines, gotchas, or important notes for new developers joining the codebase.]`;

      case "architecture-chunk":
        return `Analyze this chunk of files from the repository file tree:
${context?.fileTree}

Provide a concise, high-level summary of the modules, components, and responsibilities represented by these files. This summary will be combined with other chunk summaries to build a final architecture overview.`;

      default:
        return `${fullContext}\n\nAnalyze this repository and provide insights.`;
    }
  }

  /**
   * Build code analysis prompt
   */
  private buildCodeAnalysisPrompt(
    code: string,
    language: string,
    analysisType: string,
    context?: string,
  ): string {
    // Truncate code to ~150000 characters to prevent API 400 Context Overflow
    const MAX_CODE_LENGTH = 150000;
    const truncatedCode = code.length > MAX_CODE_LENGTH 
      ? code.substring(0, MAX_CODE_LENGTH) + "\n...[Code truncated due to length limits]" 
      : code;

    const basePrompt = `Language: ${language}\n${context ? `Context: ${context}\n` : ""}\n\nCode:\n\`\`\`${language}\n${truncatedCode}\n\`\`\`\n\n`;

    switch (analysisType) {
      case "explain":
        return `${basePrompt}Explain what this code does in clear, simple terms. Include:
1. Overall purpose
2. Key logic and algorithms
3. Important variables and their roles
4. Edge cases handled`;

      case "improve":
        return `${basePrompt}Suggest improvements for this code:
1. Code quality enhancements
2. Performance optimizations
3. Better error handling
4. More idiomatic patterns
Provide specific code examples.`;

      case "bugs":
        return `${basePrompt}Identify potential bugs and issues:
1. Logic errors
2. Edge cases not handled
3. Performance bottlenecks
4. Security vulnerabilities
5. Type safety issues
Be specific about line numbers if possible.`;

      case "document":
        return `${basePrompt}Generate comprehensive documentation:
1. Function/class documentation
2. Parameter descriptions
3. Return value documentation
4. Usage examples
5. Important notes or warnings
Use appropriate doc format for ${language}.`;

      case "refactor":
        return `${basePrompt}Suggest refactoring improvements:
1. Extract reusable functions
2. Simplify complex logic
3. Improve naming
4. Reduce duplication
5. Enhance readability
Provide refactored code examples.`;

      default:
        return `${basePrompt}Analyze this code and provide insights.`;
    }
  }

  /**
   * Build repository chat prompt
   */
  private buildRepositoryChatPrompt(
    question: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    context?: AIRepositoryChatRequest["context"],
  ): string {
    let prompt =
      "You are an expert code analyst helping developers understand their repository.\n\n";

    if (context) {
      prompt += "Repository Context:\n";
      if (context.files?.length) {
        prompt += `Files: ${context.files.slice(0, 10).join(", ")}${context.files.length > 10 ? "..." : ""}\n`;
      }
      if (context.recentCommits?.length) {
        prompt += `Recent commits:\n${context.recentCommits.slice(0, 5).join("\n")}\n`;
      }
      if (context.contributors?.length) {
        prompt += `Contributors: ${context.contributors.slice(0, 5).join(", ")}\n`;
      }
      if (context.knowledge) {
        prompt += `\nMaintainer Context (Highest Priority):\n`;
        if (context.knowledge.projectDescription) {
          prompt += `Project Description: ${context.knowledge.projectDescription}\n`;
        }
        if (context.knowledge.architecturePrinciples?.length) {
          prompt += `Architecture Principles:\n- ${context.knowledge.architecturePrinciples.join('\n- ')}\n`;
        }
        if (context.knowledge.glossary && Object.keys(context.knowledge.glossary).length > 0) {
          prompt += `Glossary:\n`;
          Object.entries(context.knowledge.glossary).forEach(([k, v]) => {
            prompt += `- ${k}: ${v}\n`;
          });
        }
        if (context.knowledge.onboardingNotes?.length) {
          prompt += `Onboarding Notes:\n- ${context.knowledge.onboardingNotes.join('\n- ')}\n`;
        }
      }
      prompt += "\n";
    }

    if (conversationHistory?.length) {
      prompt += "Previous conversation:\n";
      conversationHistory.forEach((msg) => {
        prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
      });
      prompt += "\n";
    }

    prompt += `User question: ${question}\n\nProvide a helpful, accurate response based on the repository context.`;

    return prompt;
  }
}

let geminiServiceSingleton: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiServiceSingleton) {
    geminiServiceSingleton = new GeminiService();
  }
  return geminiServiceSingleton;
}
