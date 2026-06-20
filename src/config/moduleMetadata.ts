export type ComplexityLevel = "Low" | "Medium" | "High";
export type ContributorLevel = "Beginner" | "Intermediate" | "Advanced";

export interface ModuleMetadata {
  name: string;
  purpose: string;
  description: string;
  complexity: ComplexityLevel;
  importance: string;
  recommendedFor: ContributorLevel[];
  examples?: string[];
}

export const MODULE_METADATA: Record<string, ModuleMetadata> = {
  components: {
    name: "components",
    purpose: "Reusable UI building blocks",
    description:
      "Contains all reusable React components used throughout the application. This is the primary location for visual elements and UI patterns.",
    complexity: "Medium",
    importance: "Core Module",
    recommendedFor: ["Beginner", "Intermediate"],
    examples: [
      "Button",
      "Card",
      "Modal",
      "Dropdown",
      "Form inputs",
      "Layout components",
    ],
  },
  services: {
    name: "services",
    purpose: "Business logic and data operations",
    description:
      "Handles API communication, data transformation, and business logic. Contains service classes that manage application workflows and integrate with external APIs.",
    complexity: "High",
    importance: "Critical Area",
    recommendedFor: ["Intermediate", "Advanced"],
    examples: [
      "API clients",
      "Data transformation",
      "State management",
      "External integrations",
    ],
  },
  hooks: {
    name: "hooks",
    purpose: "Reusable React logic",
    description:
      "Custom React hooks that encapsulate stateful logic and side effects. Shared across components to maintain consistency and reduce code duplication.",
    complexity: "Medium",
    importance: "Core Module",
    recommendedFor: ["Intermediate", "Advanced"],
    examples: [
      "useEffect logic",
      "State management",
      "Custom hooks",
      "Context consumers",
    ],
  },
  utils: {
    name: "utils",
    purpose: "Shared helper functions",
    description:
      "Utility functions and helper libraries used across the codebase. Contains pure functions, formatting utilities, and general-purpose helpers.",
    complexity: "Low",
    importance: "Supporting Area",
    recommendedFor: ["Beginner", "Intermediate", "Advanced"],
    examples: [
      "String formatting",
      "Date parsing",
      "Validators",
      "Converters",
    ],
  },
  auth: {
    name: "auth",
    purpose: "Authentication and authorization",
    description:
      "Manages user authentication, session handling, and access control. Critical for security and requires careful attention when making changes.",
    complexity: "High",
    importance: "Critical Area",
    recommendedFor: ["Advanced"],
    examples: [
      "Login/logout",
      "Token management",
      "Permission checks",
      "Session handling",
    ],
  },
  pages: {
    name: "pages",
    purpose: "Application routes and screens",
    description:
      "Contains page components that represent application routes. Each page combines multiple components to create complete screens.",
    complexity: "Medium",
    importance: "Core Module",
    recommendedFor: ["Intermediate"],
    examples: [
      "Dashboard page",
      "Repository page",
      "Settings page",
      "Search page",
    ],
  },
  api: {
    name: "api",
    purpose: "API endpoints and handlers",
    description:
      "Defines server-side API routes and request handlers. Manages data flow between client and backend services.",
    complexity: "High",
    importance: "Core Module",
    recommendedFor: ["Intermediate", "Advanced"],
    examples: [
      "REST endpoints",
      "Request validation",
      "Response formatting",
      "Error handling",
    ],
  },
  context: {
    name: "context",
    purpose: "React Context providers",
    description:
      "Contains React Context definitions for global state management. Used to share data across component trees without prop drilling.",
    complexity: "Medium",
    importance: "Core Module",
    recommendedFor: ["Intermediate"],
    examples: [
      "Theme context",
      "Auth context",
      "User preferences",
      "Application state",
    ],
  },
  lib: {
    name: "lib",
    purpose: "Core library utilities",
    description:
      "Core utility libraries and configuration. Contains shared logic that supports multiple features across the application.",
    complexity: "High",
    importance: "Core Module",
    recommendedFor: ["Intermediate", "Advanced"],
    examples: [
      "Configuration",
      "Initialization logic",
      "Shared utilities",
      "Constants",
    ],
  },
};

export function getComplexityColor(
  complexity: ComplexityLevel
): {
  bg: string;
  text: string;
  ring: string;
} {
  switch (complexity) {
    case "Low":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600",
        ring: "ring-emerald-500/20",
      };
    case "Medium":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-700",
        ring: "ring-amber-500/20",
      };
    case "High":
      return {
        bg: "bg-red-500/10",
        text: "text-red-600",
        ring: "ring-red-500/20",
      };
  }
}

export function getAvailableModules(): string[] {
  return Object.keys(MODULE_METADATA).sort();
}

export function getModuleMetadata(moduleName: string): ModuleMetadata | null {
  return MODULE_METADATA[moduleName.toLowerCase()] || null;
}
