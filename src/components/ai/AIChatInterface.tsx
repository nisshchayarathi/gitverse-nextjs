import { Input } from "@/components/ui/Input";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, User, Bot, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { geminiService, ChatMessage } from "@/services/gemini";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface AIChatInterfaceProps {
  repositoryContext?: {
    name: string;
    description?: string;
    languages: string[];
    stats?: {
      commits: number;
      contributors: number;
      files: number;
    };
  };
}

const mentorMarkdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
      title="Copy code"
      aria-label="Copy code to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4 text-white/70" />
      )}
    </button>
  );
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, mentorMarkdownSchema]]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-4"
            {...props}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => {
          const text = String(children ?? "");
          const isBlock =
            (typeof className === "string" &&
              className.includes("language-")) ||
            text.includes("\n");

          if (!isBlock) {
            return (
              <code
                className="rounded bg-black/30 px-1 py-0.5 text-[0.9em]"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="relative">
              <CopyButton text={text} />

              <pre className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 border border-white/10">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AIChatInterface({ repositoryContext }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
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
    // Load initial greeting
    if (messages.length === 0) {
      const greeting = repositoryContext
        ? `Hello! I'm your AI assistant for the **${repositoryContext.name}** repository. I can help you understand the code, find bugs, suggest improvements, and answer questions about this project. How can I assist you today?`
        : `Hello! I'm your AI assistant. I can help you with code analysis, explanations, bug detection, and more. What would you like to know?`;

      setMessages([
        {
          role: "assistant",
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (isAuthLoading || !isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please log in to use the AI assistant.",
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
      let fullResponse = "";
      // Pass the current messages array as history (excluding the current prompt which is appended by chatRaw)
      const stream = geminiService.chatStream(input, repositoryContext, messages);

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

  const handleClearChat = () => {
    const greeting = repositoryContext
      ? `Hello! I'm your AI assistant for the **${repositoryContext.name}** repository. I can help you understand the code, find bugs, suggest improvements, and answer questions about this project. How can I assist you today?`
      : `Hello! I'm your AI assistant. I can help you with code analysis, explanations, bug detection, and more. What would you like to know?`;

    setMessages([
      {
        role: "assistant",
        content: greeting,
        timestamp: new Date(),
      },
    ]);
    setStreamingMessage("");
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <Card
              className={`glass max-w-[80%] p-4 ${
                message.role === "user" ? "bg-primary/10" : "bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-semibold opacity-70">
                  {message.role === "user" ? "You" : "AI Assistant"}
                </span>
                <button
                  onClick={() => copyToClipboard(message.content, index)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy message"
                >
                  {copiedIndex === index ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="text-sm leading-relaxed">
                <ChatMarkdown content={message.content} />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </Card>
            {message.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-500" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {isLoading && streamingMessage && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <Card className="glass max-w-[80%] p-4 bg-white/5">
              <div className="text-xs font-semibold opacity-70 mb-2">
                AI Assistant
              </div>
              <div className="text-sm leading-relaxed">
                <ChatMarkdown content={streamingMessage} />
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Generating response...</span>
              </div>
            </Card>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingMessage && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <Card className="glass max-w-[80%] p-4 bg-white/5">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-4">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Powered by Google Gemini AI</span>
          </div>
          {messages.length > 1 && (
            <button
              onClick={handleClearChat}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Chat
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your repository..."
            className="flex-1 glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="glass px-6 py-3 rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
