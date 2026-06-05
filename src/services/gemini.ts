export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface CodeAnalysisRequest {
  code: string;
  language: string;
  analysisType: "explain" | "bugs" | "improve" | "document";
}

export interface RepositoryContext {
  id?: number;
  name: string;
  description?: string;
  languages: string[];
  stats?: {
    commits: number;
    contributors: number;
    files: number;
  };
}

class GeminiService {
  constructor() {}

  private getAuthHeaders(): Record<string, string> {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("gitverse_token")
        : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  isConfigured(): boolean {
    // The Gemini API key is server-side; authentication is handled by the caller
    // (via AuthContext) and enforced by the API route.
    return true;
  }

  async chat(
    message: string,
    context?: RepositoryContext,
    history: ChatMessage[] = [],
    signal?: AbortSignal
  ): Promise<string> {
    try {
      // Add repository context to the prompt if provided
      let enhancedMessage = message;
      if (context) {
        const contextInfo = `
Repository Context:
- Name: ${context.name}
${context.description ? `- Description: ${context.description}` : ""}
- Languages: ${context.languages.join(", ")}
${context.stats ? `- Stats: ${context.stats.commits} commits, ${context.stats.contributors} contributors, ${context.stats.files} files` : ""}

User Question: ${message}
`;
        enhancedMessage = contextInfo;
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        signal,
        body: JSON.stringify({ 
          repositoryId: context?.id ? Number(context.id) : undefined, 
          prompt: enhancedMessage, 
          messages: history 
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || data?.details || "Failed to get AI response"
        );
      }

      const text = data?.response;
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI service");
      }

      // Local chat history storage removed in favor of UI state

      return text;
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error;
    }
  }

  async *chatStream(
    message: string,
    context?: RepositoryContext,
    history: ChatMessage[] = [],
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    try {
      // Server route isn't streaming; yield the full response once.
      const text = await this.chat(message, context, history, signal);
      yield text;
    } catch (error) {
      console.error("Gemini API streaming error:", error);
      throw error;
    }
  }

  async analyzeCode(request: CodeAnalysisRequest): Promise<string> {
    try {
      const res = await fetch("/api/ai/analyze-code", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(request),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || data?.details || "Failed to analyze code"
        );
      }

      const text = data?.analysis;
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI service");
      }

      return text;
    } catch (error) {
      console.error("Code analysis error:", error);
      throw new Error("Failed to analyze code");
    }
  }

  async analyzeRepository(repositoryId: number, type: string): Promise<{ analysis: string; isTruncated: boolean }> {
    try {
      const res = await fetch("/api/ai/analyze-repository", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ repositoryId, type }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || data?.details || "Failed to analyze repository"
        );
      }

      const text = data?.analysis;
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI service");
      }

      return {
        analysis: text,
        isTruncated: !!data?.isTruncated,
      };
    } catch (error) {
      console.error("Repository analysis error:", error);
      throw new Error("Failed to analyze repository");
    }
  }

  async compareRepositories(repositoryIds: number[]): Promise<string> {
    try {
      const res = await fetch("/api/ai/compare", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ repositoryIds }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to compare repositories"
        );
      }

      const text = data?.comparison;
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI service");
      }

      return text;
    } catch (error) {
      console.error("Repository comparison error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to compare repositories"
      );
    }
  }

  async simulatePullRequest(repositoryId: number | undefined, diff: string): Promise<string> {
    try {
      const res = await fetch("/api/ai/simulate-pr", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ repositoryId, diff }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to simulate pull request review"
        );
      }

      const text = data?.review;
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI service");
      }

      return text;
    } catch (error) {
      console.error("PR simulator error:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to simulate pull request review"
      );
    }
  }

  getChatHistory(): ChatMessage[] {
    return [];
  }

  clearChatHistory(): void {
    // No-op
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
