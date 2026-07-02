"use client";

import { useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  BookOpen,
  Code,
  Terminal,
  Download,
} from "lucide-react";

const documentationSections = [
  {
    icon: BookOpen,
    title: "Module Overview",
    content:
      "This module manages repository analysis and provides insights about project structure and architecture.",
  },
  {
    icon: Code,
    title: "Functions & Components",
    content:
      "AI generated summaries explain the purpose, inputs, outputs, and responsibilities of important functions and components.",
  },
  {
    icon: Terminal,
    title: "API & Usage Examples",
    content:
      "Includes API endpoint descriptions, setup instructions, and example implementation snippets.",
  },
];

export default function DocumentationGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const generateDocumentation = () => {
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);
      setShowDocs(true);
    }, 1500);
  };

  const exportMarkdown = () => {
    const markdownContent = `
# Repository Documentation

## Module Overview
Repository analysis and architecture insights.

## Functions & Components
AI-generated explanations for major components and functions.

## API & Usage
Setup guides, API details, and usage examples.
`;

    const blob = new Blob([markdownContent], {
      type: "text/markdown",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "REPOSITORY_DOCUMENTATION.md";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border p-6 shadow-sm bg-background">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">
            AI Documentation Generator
          </h2>
        </div>

        <button
          onClick={generateDocumentation}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Docs
            </>
          )}
        </button>
      </div>

      {!showDocs && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate AI-powered documentation for repository modules,
          components, APIs, and usage examples.
        </p>
      )}

      {showDocs && (
        <div className="space-y-4">
          {documentationSections.map((section, index) => {
            const Icon = section.icon;

            return (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-blue-500" />
                  <h3 className="font-medium">
                    {section.title}
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  {section.content}
                </p>
              </div>
            );
          })}

          <button
            onClick={exportMarkdown}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition"
          >
            <Download className="h-4 w-4" />
            Export Markdown
          </button>
        </div>
      )}
    </div>
  );
}