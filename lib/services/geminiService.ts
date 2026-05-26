import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export interface AIAnalysisRequest {
  repositoryId: number;
  type:
    | "overview"
    | "code-quality"
    | "security"
    | "architecture"
    | "suggestions";
  context?: {
    targetDirectory?: string;
    files?: Array<{ path: string; content: string }>;
    commits?: Array<{ message: string; author: string; date: string }>;
    languages?: Array<{ name: string; percentage: number }>;
    contributors?: Array<{ name: string; commits: number }>;
  };
}

export interface AICodeAnalysisRequest {
  code: string;
  language: string;
  analysisType: "explain" | "improve" | "bugs" | "document" | "refactor";
  context?: string;
}

export interface AIRepositoryChatRequest {
  repositoryId: number;
  question: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    files?: string[];
    recentCommits?: string[];
    contributors?: string[];
  };
}

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is required");
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

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze code snippet
   */
  async analyzeCode(request: AICodeAnalysisRequest): Promise<string> {
    const { code, language, analysisType, context } = request;

    let prompt = this.buildCodeAnalysisPrompt(
      code,
      language,
      analysisType,
      context
    );

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini code analysis error:", error);
      throw new Error(`Code analysis failed: ${error.message}`);
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
      context
    );

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini chat error:", error);
      throw new Error(`AI chat failed: ${error.message}`);
    }
  }

  /**
   * Chat using a pre-built prompt (free-form)
   */
  async chatRaw(
    prompt: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
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
            parts: [{ text: msg.content }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ];

        const result = await this.model.generateContent({ contents });
        const response = await result.response;
        return response.text();
      } else {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }
    } catch (error: any) {
      console.error("Gemini raw chat error:", error);
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
    const prompt = `
Generate 3 conventional commit messages for the following code changes:

Added files: ${changes.added.join(", ") || "none"}
Modified files: ${changes.modified.join(", ") || "none"}
Deleted files: ${changes.deleted.join(", ") || "none"}

${changes.diff ? `Diff:\n${changes.diff.substring(0, 1000)}` : ""}

Format: type(scope): subject
Examples: feat(auth): add login endpoint, fix(ui): resolve button alignment

Provide only the commit messages, one per line.
`;

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
    context?: AIAnalysisRequest["context"]
  ): string {
    const baseContext = `
Repository Context:
- Target directory: ${context?.targetDirectory || "Full repository"}
- Languages: ${context?.languages?.map((l) => `${l.name} (${l.percentage}%)`).join(", ") || "Unknown"}
- Contributors: ${context?.contributors?.length || 0}
- Recent commits: ${context?.commits?.length || 0}
`;

    const scopeNote = context?.targetDirectory
      ? `\nImportant: Restrict your analysis to the target directory (${context.targetDirectory}). Only reference files outside this directory if they are immediately required dependencies.\n`
      : "";

    switch (type) {
      case "overview":
        return `${baseContext}${scopeNote}

Provide a comprehensive overview of this repository including:
1. Primary purpose and functionality
2. Technology stack analysis
3. Project maturity and activity level
4. Key strengths and areas for improvement

Be concise but informative.`;

      case "code-quality":
        return `${baseContext}${scopeNote}

Analyze the code quality of this repository:
1. Code organization and structure
2. Naming conventions and consistency
3. Documentation quality
4. Testing coverage indicators
5. Specific recommendations for improvement

Provide actionable insights.`;

      case "security":
        return `${baseContext}${scopeNote}

Perform a security analysis:
1. Potential security vulnerabilities
2. Dependencies that may need updates
3. Authentication and authorization patterns
4. Data handling practices
5. Security best practices recommendations`;

      case "architecture":
        return `${baseContext}${scopeNote}

Analyze the software architecture:
1. Overall architecture pattern (MVC, microservices, etc.)
2. Component organization
3. Data flow and dependencies
4. Scalability considerations
5. Architectural recommendations`;

      case "suggestions":
        return `${baseContext}${scopeNote}

Provide improvement suggestions:
1. Code refactoring opportunities
2. Performance optimization ideas
3. Feature enhancement suggestions
4. Development workflow improvements
5. Technology upgrade recommendations

Prioritize by impact and effort.`;

      default:
        return `${baseContext}\n\nAnalyze this repository and provide insights.`;
    }
  }

  /**
   * Build code analysis prompt
   */
  private buildCodeAnalysisPrompt(
    code: string,
    language: string,
    analysisType: string,
    context?: string
  ): string {
    const basePrompt = `Language: ${language}\n${context ? `Context: ${context}\n` : ""}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;

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
    context?: AIRepositoryChatRequest["context"]
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
