"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  CopyToClipboard,
} from "@/components/ui";
import { buildApiUrl } from "@/services/apiConfig";

type Role = "user" | "assistant";

type MentorMessage = {
  role: Role;
  content: string;
};

type MentorContributor = {
  name?: string | null;
  email?: string | null;
  commits?: number | null;
  additions?: number | null;
  deletions?: number | null;
};

const mentorMarkdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
  },
};

function MentorMarkdown({ content }: { content: string }) {
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

          const codeString = text.replace(/\n$/, "");
          return (
            <div className="relative group my-2">
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 border border-white/10">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
              <CopyToClipboard
                text={codeString}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              />
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function buildMentorPrompt(args: {
  repoName: string;
  description?: string;
  languages: string[];
  readmeText?: string | null;
  contributors?: MentorContributor[];
  conversation: MentorMessage[];
  question: string;
}): string {
  const history = args.conversation
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Mentor"}: ${m.content}`)
    .join("\n\n");

  const readme = (args.readmeText || "").trim();
  const readmeBlock = readme
    ? `\n\n===== README (${Math.min(readme.length, 200000)} chars) =====\n${readme}\n===== END README =====`
    : "\n\n(README not available yet.)";

  const contributors = Array.isArray(args.contributors)
    ? args.contributors
    : [];
  const contributorLines = contributors
    .filter((c) => (c?.name || c?.email) && (c?.commits ?? 0) >= 0)
    .sort(
      (a, b) => (Number(b?.commits ?? 0) || 0) - (Number(a?.commits ?? 0) || 0),
    )
    .slice(0, 25)
    .map((c, idx) => {
      const label = (c?.name || c?.email || "Unknown").toString().trim();
      const commits = Number(c?.commits ?? 0) || 0;
      const additions = Number(c?.additions ?? 0) || 0;
      const deletions = Number(c?.deletions ?? 0) || 0;
      return `${idx + 1}. ${label} — ${commits} commits (+${additions}/-${deletions})`;
    })
    .join("\n");
  const contributorsBlock = contributorLines
    ? `\n\n===== CONTRIBUTORS (from analysis) =====\n${contributorLines}\n===== END CONTRIBUTORS =====`
    : "\n\n(Contributor stats not available yet.)";

  return `You are an AI Mentor helping a developer understand and work with a repository.

===== REPO CONTEXT =====
Name: ${args.repoName}
${args.description ? `Description: ${args.description}` : ""}
Languages: ${args.languages.join(", ") || "Unknown"}
${readmeBlock}
${contributorsBlock}

===== BEHAVIOR =====
- Prefer answers grounded in the README and the languages list.
- If contributor stats are present, use them for questions like "top contributor".
- If the README is missing, say what info is missing and give best-effort general guidance.
- Be concise and actionable.

${history ? `===== RECENT CHAT =====\n${history}\n\n` : ""}User Question: ${args.question}`;
}

export function AIRepoMentorSection(props: {
  repositoryId: number;
  repoName: string;
  description?: string;
  languages: string[];
  readmeText?: string | null;
  contributors?: MentorContributor[];
  disabled?: boolean;
  disabledHint?: string;
}) {
  const presets = useMemo(
    () => [
      "How do I set this up locally?",
      "What is the tech stack in this repo?",
      "Where should I start if I want to contribute?",
      "How do I run tests and linting?",
    ],
    [],
  );

  const [messages, setMessages] = useState<MentorMessage[]>([
    {
      role: "assistant",
      content: "Ask me about setup, tech stack, or where to start",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottomRef = useRef(true);

  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
      const el = bottomRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior, block: "end" });
    };
    const id = requestAnimationFrame(() => scrollToBottom("smooth"));
    return () => cancelAnimationFrame(id);
  }, [messages.length, isLoading]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading || props.disabled) return;

    pinnedToBottomRef.current = true;
    const userMessage: MentorMessage = { role: "user", content: trimmed };
    const nextConversation: MentorMessage[] = [...messages, userMessage];
    setMessages(nextConversation);
    setInput("");
    setIsLoading(true);

    try {
      const prompt = buildMentorPrompt({
        repoName: props.repoName,
        description: props.description,
        languages: props.languages,
        readmeText: props.readmeText,
        contributors: props.contributors,
        conversation: nextConversation,
        question: trimmed,
      });

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("gitverse_token")
          : null;

      const res = await fetch(buildApiUrl("/api/ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ repositoryId: props.repositoryId, prompt }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || data?.details || "Failed to get AI response",
        );
      }

      const text = typeof data?.response === "string" ? data.response : "";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text || "I couldn't generate a response. Please try again.",
        },
      ]);
      pinnedToBottomRef.current = true;
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: e?.message || "Something went wrong. Please try again.",
        },
      ]);
      pinnedToBottomRef.current = true;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="font-heading text-lg sm:text-xl flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          AI Mentor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
        {props.disabled && (
          <div className="text-xs text-muted-foreground">
            {props.disabledHint ||
              "Preparing context (fetching README) before enabling chat…"}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {presets.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => send(q)}
              disabled={isLoading || props.disabled}
            >
              {q}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border border-border/50 bg-background/50 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="max-h-72 overflow-y-auto p-3 sm:p-4 space-y-3"
            onScroll={() => {
              const el = scrollContainerRef.current;
              if (!el) return;
              const distanceFromBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight;
              pinnedToBottomRef.current = distanceFromBottom < 120;
            }}
          >
            {messages.length === 1 && !isLoading && (
              <div className="flex flex-col items-center justify-center text-center py-8 px-4">
  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
    <Sparkles className="h-6 w-6 text-primary" />
  </div>

  <h3 className="text-sm font-semibold mb-2">
    No repository questions yet
  </h3>

  <p className="text-xs text-muted-foreground max-w-sm mb-4">
    Ask about setup, architecture, contributors, scripts, or repository structure to start using the AI mentor.
  </p>

  <Button
    type="button"
    variant="outline"
    onClick={() => send("How do I set this up locally?")}
    disabled={props.disabled || isLoading}
  >
    Try Example Question
  </Button>
</div>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user"
                    ? "bg-primary/15"
                    : "bg-white/5 border border-white/10"
                    }`}
                >
                  {m.role === "assistant" ? (
                    <MentorMarkdown content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
  <div className="flex gap-2 justify-start" aria-live="polite">
    <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 animate-pulse">
      <Bot className="h-4 w-4 text-primary/50" aria-hidden="true" />
    </div>

    <div className="max-w-[85%] w-full sm:w-2/3 rounded-lg px-3 py-3 bg-white/5 border border-white/10 space-y-2 animate-pulse">
      <div className="h-3 w-3/4 rounded bg-white/10" />
      <div className="h-3 w-full rounded bg-white/10" />
      <div className="h-3 w-5/6 rounded bg-white/10" />
      <div className="h-3 w-1/2 rounded bg-white/10" />
    </div>
  </div>
)}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border/50 p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about setup, scripts, architecture…"
                className="flex-1 glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading || props.disabled}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading || props.disabled}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
