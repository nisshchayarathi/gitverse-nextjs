
"use client";

import { Input } from "@/components/ui/Input";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, User, Bot, Copy, Check, Square } from "lucide-react";
import { Card } from "@/components/ui";
import { geminiService, ChatMessage } from "@/services/gemini";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useParams } from "next/navigation";
import { FileCode, FileText, X, ChevronRight, CornerDownRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { buildApiUrl } from "@/services/apiConfig";

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileFetchControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const params = useParams();
  const repositoryId = params?.id as string;

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const lineCount = fileContent ? fileContent.split("\n").length : 0;

  const handleSelectFile = async (path: string) => {
    // Abort previous file fetch if it exists
    if (fileFetchControllerRef.current) {
      fileFetchControllerRef.current.abort();
    }

    const controller = new AbortController();
    fileFetchControllerRef.current = controller;

    setSelectedFilePath(path);
    setDrawerOpen(true);
    setIsLoadingContent(true);
    setFetchError(null);
    setFileContent(null);

    if (!repositoryId) {
      toast({
        title: "Error",
        description: "Repository ID is required to fetch file contents.",
        variant: "destructive",
      });
      setIsLoadingContent(false);
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("gitverse_token") : null;
      const response = await fetch(
        buildApiUrl(`/api/repositories/${repositoryId}/files/content?path=${encodeURIComponent(path)}`),
        {
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch file content");
      }
      const data = await response.json();
      if (fileFetchControllerRef.current === controller) {
        setFileContent(data.content);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }
      if (fileFetchControllerRef.current === controller) {
        console.error("Error fetching file content:", error);
        setFetchError(error.message || "Failed to load file content.");
      }
    } finally {
      if (fileFetchControllerRef.current === controller) {
        setIsLoadingContent(false);
      }
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedFilePath(null);
    setFileContent(null);
    setFetchError(null);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };


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
  }, [messages.length, repositoryContext]);

  useEffect(() => {
    return () => {
      if (fileFetchControllerRef.current) {
        fileFetchControllerRef.current.abort();
      }
    };
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
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullResponse = "";
    try {
      // Pass the current messages array as history (excluding the current prompt which is appended by chatRaw)
      const stream = geminiService.chatStream(currentInput, repositoryContext, messages, controller.signal);

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
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Chat generation aborted by user.");
        if (fullResponse) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: fullResponse + " _[Generation stopped by user]_",
              timestamp: new Date(),
            },
          ]);
        }
        setStreamingMessage("");
      } else {
        console.error("Chat error:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to get AI response",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
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
              {message.role === "assistant" && (
                <MessageReferenceCards
                  content={message.content}
                  onSelectFile={handleSelectFile}
                />
              )}
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

        {/* Suggested Questions (only show when chat has just the greeting) */}
        {messages.length === 1 && !isLoading && (
          <div className="mt-8 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Suggested questions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Can you explain the main architecture of this repository?",
                "Where is the authentication logic located?",
                "How do I set up this project locally?",
                "What are the main dependencies used in this project?",
              ].map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(question);
                    // Slight delay to allow state update before submission
                    setTimeout(() => {
                      const form = document.getElementById("ai-chat-form") as HTMLFormElement;
                      if (form) form.requestSubmit();
                    }, 50);
                  }}
                  className="text-left p-3 text-sm glass rounded-lg hover:bg-primary/10 transition-colors border border-white/5 hover:border-primary/30"
                >
                  <p className="line-clamp-2 text-foreground/80">{question}</p>
                </button>
              ))}
            </div>
          </div>
        )}

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
        <form id="ai-chat-form" onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your repository..."
            className="flex-1 glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            disabled={isLoading}
          />
          {isLoading && (
            <button
              type="button"
              onClick={handleStop}
              className="bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-2"
            >
              <Square className="h-4 w-4 fill-destructive" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
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

      {/* Side Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedFilePath && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDrawer}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[650px] bg-slate-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate">
                    {selectedFilePath.split("/").pop()}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    {selectedFilePath}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloseDrawer}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#1E1E1E]">
                {isLoadingContent ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">Loading file content...</p>
                  </div>
                ) : fetchError ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6 gap-3">
                    <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                      <X className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold">Failed to load content</p>
                    <p className="text-xs text-muted-foreground max-w-sm">{fetchError}</p>
                  </div>
                ) : fileContent ? (
                  <div className="space-y-4">
                    {/* File metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                      <span>{lineCount} lines</span>
                      <span>•</span>
                      <span>{formatBytes(fileContent.length)}</span>
                    </div>

                    <div className="relative rounded-lg border border-white/10 bg-black/30 overflow-hidden text-sm">
                      <div className="absolute top-2 right-2 z-10">
                        <CopyButton text={fileContent} />
                      </div>
                      <SyntaxHighlighter
                        language={selectedFilePath.split(".").pop()?.toLowerCase() || "text"}
                        style={vscDarkPlus}
                        showLineNumbers={true}
                        customStyle={{
                          margin: 0,
                          padding: "1rem",
                          background: "transparent",
                          fontSize: "0.825rem",
                          lineHeight: "1.5",
                        }}
                        wrapLines={true}
                      >
                        {fileContent}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                    <FileText className="h-12 w-12 opacity-30" />
                    <p className="text-sm">File is empty</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
};

export function extractFilePaths(content: string): string[] {
  const paths = new Set<string>();
  
  // 1. Bracket matches: [src/components/Button.tsx]
  const bracketRegex = /\[([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,8})\]/g;
  let match;
  while ((match = bracketRegex.exec(content)) !== null) {
    paths.add(match[1]);
  }
  
  // 2. Backtick matches: `src/components/Button.tsx`
  const backtickRegex = /`([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,8})`/g;
  while ((match = backtickRegex.exec(content)) !== null) {
    paths.add(match[1]);
  }
  
  // 3. Raw word matches that look like paths (contain at least one slash and an extension)
  const rawRegex = /(?:\s|^)([a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,8})\b/g;
  while ((match = rawRegex.exec(content)) !== null) {
    paths.add(match[1]);
  }
  
  return Array.from(paths);
}

function MessageReferenceCards({ content, onSelectFile }: { content: string; onSelectFile: (path: string) => void }) {
  const filePaths = extractFilePaths(content);
  if (filePaths.length === 0) return null;

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    const iconClass = "h-4 w-4 shrink-0";
    switch (ext) {
      case "ts":
      case "tsx":
        return <FileCode className={`${iconClass} text-blue-500`} />;
      case "js":
      case "jsx":
        return <FileCode className={`${iconClass} text-yellow-500`} />;
      case "css":
      case "scss":
        return <FileText className={`${iconClass} text-purple-500`} />;
      case "json":
        return <FileText className={`${iconClass} text-green-500`} />;
      case "md":
        return <FileText className={`${iconClass} text-gray-500`} />;
      default:
        return <FileText className={`${iconClass} text-muted-foreground`} />;
    }
  };

  return (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
      <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <CornerDownRight className="h-3 w-3" />
        <span>Referenced Files</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filePaths.map((filePath, idx) => {
          const fileName = filePath.split("/").pop() || filePath;
          return (
            <button
              key={idx}
              onClick={() => onSelectFile(filePath)}
              className="flex items-center gap-2 p-2.5 text-left glass rounded-lg hover:bg-primary/10 border border-white/5 hover:border-primary/30 transition-all group shrink-0 min-w-0"
              title={`Inspect ${filePath}`}
            >
              {getFileIcon(fileName)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground/80 truncate group-hover:text-foreground">
                  {fileName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {filePath}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
