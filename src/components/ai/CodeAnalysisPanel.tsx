import { useState } from "react";
import {
  Code,
  Bug,
  Lightbulb,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui";
import { geminiService, CodeAnalysisRequest } from "@/services/gemini";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type AnalysisType = "explain" | "bugs" | "improve" | "document";

interface AnalysisResult {
  type: AnalysisType;
  result: string;
  timestamp: Date;
}

export function CodeAnalysisPanel() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("explain");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const analysisOptions = [
    {
      type: "explain" as AnalysisType,
      label: "Explain Code",
      icon: Code,
      description: "Get a detailed explanation of what the code does",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      type: "bugs" as AnalysisType,
      label: "Find Bugs",
      icon: Bug,
      description: "Detect potential bugs and issues",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      type: "improve" as AnalysisType,
      label: "Suggest Improvements",
      icon: Lightbulb,
      description: "Get suggestions for better code quality",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      type: "document" as AnalysisType,
      label: "Generate Docs",
      icon: FileText,
      description: "Create documentation for your code",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please enter some code to analyze",
        variant: "destructive",
      });
      return;
    }

    if (isAuthLoading || !isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please log in to use AI features.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const request: CodeAnalysisRequest = {
        code,
        language,
        analysisType,
      };

      const result = await geminiService.analyzeCode(request);

      setResults((prev) => [
        {
          type: analysisType,
          result,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      toast({
        title: "Analysis Complete",
        description: "Your code has been analyzed successfully",
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description:
          error instanceof Error ? error.message : "Failed to analyze code",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatResult = (content: string) => {
    return content.split("\n").map((line, i) => {
      // Code blocks
      if (line.startsWith("```")) {
        return (
          <div key={i} className="text-xs text-primary my-2">
            ───────
          </div>
        );
      }
      // Bold text
      if (line.includes("**")) {
        const parts = line.split("**");
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) =>
              j % 2 === 0 ? part : <strong key={j}>{part}</strong>
            )}
          </p>
        );
      }
      // Numbered lists
      if (/^\d+\./.test(line.trim())) {
        return (
          <li key={i} className="ml-4 mb-1 list-decimal">
            {line
              .trim()
              .substring(line.indexOf(".") + 1)
              .trim()}
          </li>
        );
      }
      // Bullet points
      if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
        return (
          <li key={i} className="ml-4 mb-1 list-disc">
            {line.trim().substring(1).trim()}
          </li>
        );
      }
      // Code inline
      if (line.includes("`")) {
        const parts = line.split("`");
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) =>
              j % 2 === 0 ? (
                part
              ) : (
                <code
                  key={j}
                  className="bg-primary/10 px-1 py-0.5 rounded text-sm font-mono"
                >
                  {part}
                </code>
              )
            )}
          </p>
        );
      }
      return line.trim() ? (
        <p key={i} className="mb-2">
          {line}
        </p>
      ) : (
        <br key={i} />
      );
    });
  };

  const selectedOption = analysisOptions.find(
    (opt) => opt.type === analysisType
  )!;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-4">
        <Card className="glass p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Code Input
          </h3>

          <div className="space-y-4">
            {/* Language selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Programming Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
              </select>
            </div>

            {/* Code input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Your Code
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full h-64 glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm resize-none"
              />
            </div>

            {/* Analysis type selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Analysis Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {analysisOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => setAnalysisType(option.type)}
                    className={`p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                      analysisType === option.type
                        ? `${option.bgColor} border-current ${option.color}`
                        : "glass border-white/10 hover:border-white/20"
                    }`}
                  >
                    <option.icon className={`h-5 w-5 mb-2 ${option.color}`} />
                    <p className="text-sm font-medium">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !code.trim()}
              className="w-full glass px-6 py-3 rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 font-medium"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <selectedOption.icon
                    className={`h-5 w-5 ${selectedOption.color}`}
                  />
                  {selectedOption.label}
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Powered by Google Gemini AI</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Results Panel */}
      <div className="space-y-4">
        <Card className="glass p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Analysis Results
          </h3>

          {results.length === 0 ? (
  <div className="flex flex-col items-center justify-center text-center py-12 px-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
      <Sparkles className="h-7 w-7 text-primary" />
    </div>

    <h3 className="text-lg font-semibold mb-2">
      No AI analysis yet
    </h3>

    <p className="text-sm text-muted-foreground max-w-sm mb-6">
      Paste your code and run an AI-powered analysis to get explanations,
      bug detection, documentation, and improvement suggestions.
    </p>

    <button
      onClick={() => {
        const textarea = document.querySelector("textarea");
        if (textarea) {
          (textarea as HTMLTextAreaElement).focus();
        }
      }}
      className="glass px-5 py-2 rounded-lg hover:bg-primary/20 transition-all duration-300"
      aria-label="Start AI analysis"
    >
      Start Analysis
    </button>
  </div>
) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {results.map((result, index) => {
                const option = analysisOptions.find(
                  (opt) => opt.type === result.type
                )!;
                return (
                  <Card key={index} className="glass p-4 bg-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <option.icon className={`h-4 w-4 ${option.color}`} />
                      <span className="font-semibold text-sm">
                        {option.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed prose prose-invert max-w-none">
                      {formatResult(result.result)}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
