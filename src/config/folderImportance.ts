export type ImportanceLevel = 1 | 2 | 3 | 4 | 5;
export type ImportanceCategory =
  | "Critical Area"
  | "Core Module"
  | "Supporting Area"
  | "Documentation";

export interface FolderImportanceInfo {
  level: ImportanceLevel;
  label: ImportanceCategory;
  description: string;
}

export const FOLDER_IMPORTANCE: Record<string, FolderImportanceInfo> = {
  auth: {
    level: 5,
    label: "Critical Area",
    description: "Changes here may affect authentication and security.",
  },
  services: {
    level: 4,
    label: "Core Module",
    description:
      "Contains business logic and shared application services.",
  },
  api: {
    level: 4,
    label: "Core Module",
    description: "Handles application endpoints and data flow.",
  },
  "api/ai": {
    level: 4,
    label: "Core Module",
    description: "AI service integration and endpoints.",
  },
  "api/analysis": {
    level: 4,
    label: "Core Module",
    description: "Analysis job management and execution.",
  },
  "api/repositories": {
    level: 4,
    label: "Core Module",
    description: "Repository data management endpoints.",
  },
  "api/integrations": {
    level: 4,
    label: "Core Module",
    description: "Third-party service integration endpoints.",
  },
  components: {
    level: 3,
    label: "Core Module",
    description: "Reusable UI building blocks.",
  },
  pages: {
    level: 3,
    label: "Core Module",
    description: "Application routes and screens.",
  },
  hooks: {
    level: 3,
    label: "Supporting Area",
    description: "Reusable React logic and state management.",
  },
  utils: {
    level: 2,
    label: "Supporting Area",
    description: "Shared helper functions and utilities.",
  },
  lib: {
    level: 3,
    label: "Core Module",
    description: "Core library functions and configurations.",
  },
  contexts: {
    level: 3,
    label: "Core Module",
    description: "React context providers and state.",
  },
  context: {
    level: 3,
    label: "Core Module",
    description: "React context providers and state.",
  },
  assets: {
    level: 1,
    label: "Supporting Area",
    description: "Static files and resources.",
  },
  public: {
    level: 1,
    label: "Supporting Area",
    description: "Public static assets.",
  },
  docs: {
    level: 1,
    label: "Documentation",
    description: "Project documentation and guides.",
  },
  prisma: {
    level: 4,
    label: "Core Module",
    description: "Database schema and migrations.",
  },
  scripts: {
    level: 2,
    label: "Supporting Area",
    description: "Utility scripts and build tools.",
  },
  deploy: {
    level: 2,
    label: "Supporting Area",
    description: "Deployment and infrastructure configuration.",
  },
  middleware: {
    level: 4,
    label: "Core Module",
    description: "Request processing and authentication middleware.",
  },
};

export function getFolderImportance(
  folderName: string
): FolderImportanceInfo | null {
  const normalized = folderName.toLowerCase().trim();
  return FOLDER_IMPORTANCE[normalized] || null;
}

export function getCategoryColor(
  category: ImportanceCategory
): {
  bg: string;
  text: string;
  ring: string;
} {
  switch (category) {
    case "Critical Area":
      return {
        bg: "bg-red-500/10",
        text: "text-red-600",
        ring: "ring-red-500/20",
      };
    case "Core Module":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        ring: "ring-blue-500/20",
      };
    case "Supporting Area":
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-600",
        ring: "ring-gray-500/20",
      };
    case "Documentation":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600",
        ring: "ring-emerald-500/20",
      };
  }
}
