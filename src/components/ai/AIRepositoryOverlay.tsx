import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { geminiService, ChatMessage } from "@/services/gemini";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface RepositoryCommit {
  message: string;
  author?: string;
  authorName?: string;
  date?: string | Date;
  committedAt?: string | Date;
}

export interface RepositoryContributor {
  name: string;
  commits: number;
  percentage?: number;
}

export interface RepositoryBranch {
  name: string;
}

interface AIRepositoryOverlayProps {
  repository: {
    name: string;
    description?: string;
    languages: { name: string; percentage: number }[];
    stats?: {
      commits: number;
      contributors: number;
      files: number;
      branches?: number;
      lines?: number;
      stars?: number;
      forks?: number;
    };
    recentCommits?: RepositoryCommit[];
    contributors?: RepositoryContributor[];
    branches?: RepositoryBranch[];
  };
}

export function AIRepositoryOverlay({ repository }: AIRepositoryOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [contextSent, setContextSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting: ChatMessage = {
        role: "assistant",
        content: `Hi! I'm here to help you understand the **${repository.name}** repository. I can answer questions about the code, architecture, commits, contributors, and more. What would you like to know?`,
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [isOpen, repository.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (isAuthLoading || !isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please log in to use the repository assistant.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");

    try {
      // Build comprehensive repository context only for first message
      const contributorsArray = Array.isArray(repository.contributors)
        ? repository.contributors
        : [];
      const contributorsCount =
        repository.stats?.contributors || contributorsArray.length || 0;
      const totalLines = repository.stats?.lines || 0;

      // Debug log to check contributor data
      console.log("Contributors data:", {
        contributorsArray,
        contributorsCount,
        hasContributors: contributorsArray.length > 0,
      });

      let contextualPrompt = "";

      // Only send full context on first message
      if (!contextSent) {
        const context = {
          name: repository.name,
          description: repository.description,
          languages: repository.languages.map((l) => l.name),
          stats: {
            commits: repository.stats?.commits || 0,
            contributors: contributorsCount,
            files: repository.stats?.files || 0,
            branches: repository.stats?.branches || 0,
            lines: totalLines,
            stars: repository.stats?.stars || 0,
            forks: repository.stats?.forks || 0,
          },
          recentActivity: repository.recentCommits
            ?.slice(0, 5)
            .map((c: RepositoryCommit) => ({
              message: c.message,
              author: c.author || c.authorName,
              date: c.date || c.committedAt,
            })),
          topContributors: contributorsArray.slice(0, 5).map((c: RepositoryContributor) => ({
            name: c.name,
            commits: c.commits,
            percentage: c.percentage,
          })),
          branches: repository.branches?.map((b: RepositoryBranch) => b.name),
        };

        contextualPrompt = `You are analyzing the ${context.name} repository. 

===== REPOSITORY DATA =====
Repository: ${context.name}
Description: ${context.description || "N/A"}
Languages: ${context.languages.join(", ")}
Total Commits: ${context.stats.commits}
Total Contributors: ${context.stats.contributors}
Total Files: ${context.stats.files}
Total Branches: ${context.stats.branches}
Lines of Code: ${context.stats.lines.toLocaleString()}
Stars: ${context.stats.stars}
Forks: ${context.stats.forks}

${
  context.topContributors && context.topContributors.length > 0
    ? `===== TOP CONTRIBUTORS (BY COMMIT COUNT) =====
${context.topContributors.map((c: RepositoryContributor, i: number) => `${i + 1}. ${c.name} - ${c.commits} commits (${c.percentage?.toFixed(1)}% of total)`).join("\n")}
The contributor with the most commits is: ${context.topContributors[0].name} with ${context.topContributors[0].commits} commits.`
    : "===== CONTRIBUTORS =====\nContributor information is not yet available for this repository."
}

${
  context.recentActivity && context.recentActivity.length > 0
    ? `===== RECENT COMMITS =====
${context.recentActivity.map((c: { message: string; author?: string }, idx: number) => `${idx + 1}. "${c.message}" by ${c.author || "Unknown"}`).join("\n")}`
    : ""
}

${context.branches && context.branches.length > 0 ? `===== BRANCHES =====\n${context.branches.join(", ")}` : ""}

===== INSTRUCTIONS =====
You MUST answer questions using ONLY the data provided above. Do NOT:
- Make up names, numbers, or any information not listed above
- Suggest running git commands or checking GitHub
- Say you don't have access to the repository

When asked about contributors or who made the most commits, use the exact names and numbers from the "TOP CONTRIBUTORS" section above.

User Question: ${input}`;
        setContextSent(true);
      } else {
        // For follow-up questions, include recent conversation history
        const recentMessages = messages.slice(-4); // Last 2 exchanges
        const conversationHistory = recentMessages
          .map(
            (msg) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n\n");

        contextualPrompt = `${conversationHistory}\n\n${input}`;
      }

      let fullResponse = "";
      const stream = geminiService.chatStream(contextualPrompt);

      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamingMessage(fullResponse);
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage("");
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    return content.split("\n").map((line, i) => {
      // Bold text
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Inline code
      line = line.replace(
        /`(.*?)`/g,
        '<code class="bg-white/5 px-1 py-0.5 rounded text-sm">$1</code>'
      );
      // Bullet points
      if (line.trim().startsWith("- ")) {
        line = '<span class="inline-block mr-2">•</span>' + line.substring(2);
      }
      return (
        <div
          key={i}
          dangerouslySetInnerHTML={{ __html: line }}
          className="leading-relaxed"
        />
      );
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-primary to-accent text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 group"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
        <span className="absolute -top-2 -right-2 bg-accent text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
          AI
        </span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isMinimized ? "w-80" : "w-96"
      }`}
    >
      <Card className="glass shadow-2xl border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-accent p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <h3 className="font-semibold text-white">Repository Assistant</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 bg-background/50">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[85%] ${
                      message.role === "user"
                        ? "bg-primary text-white"
                        : "glass border border-white/10"
                    }`}
                  >
                    <div className="text-sm">
                      {formatMessage(message.content)}
                    </div>
                  </div>
                </div>
              ))}

              {streamingMessage && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="rounded-lg px-4 py-2 max-w-[85%] glass border border-white/10">
                    <div className="text-sm">
                      {formatMessage(streamingMessage)}
                    </div>
                  </div>
                </div>
              )}

              {isLoading && !streamingMessage && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="rounded-lg px-4 py-2 glass border border-white/10">
                    <div className="text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-white/10 bg-background/80"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this repository..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-gradient-to-r from-primary to-accent text-white rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
