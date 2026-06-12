/**
 * Configuration for Knowledge Gap Detector
 * Defines thresholds, weights, and patterns for gap detection
 */

export const KNOWLEDGE_GAP_CONFIG = {
  // Complexity thresholds
  complexity: {
    high: 70,
    medium: 40,
    low: 10,
  },

  // Import count thresholds
  imports: {
    critical: 20,
    high: 10,
    medium: 5,
  },

  // File size thresholds (in bytes)
  fileSize: {
    large: 5000,
    medium: 2000,
    small: 500,
  },

  // Documentation coverage thresholds (percentage)
  documentation: {
    excellent: 80,
    good: 50,
    fair: 20,
    poor: 0,
  },

  // Risk scoring weights
  weights: {
    imports: 0.3,
    complexity: 0.25,
    fileSize: 0.15,
    documentation: 0.2,
    frequency: 0.1,
  },

  // Files to prioritize for analysis
  priorityPatterns: [
    /auth/i,
    /middleware/i,
    /payment/i,
    /database/i,
    /service/i,
    /config/i,
    /api\//i,
    /core/i,
  ],

  // File extensions to analyze
  analyzableExtensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
  ],

  // Recommended actions by risk level
  actionsByRisk: {
    Critical: [
      "Create comprehensive architecture documentation",
      "Add detailed contributor guide",
      "Create API documentation",
      "Add inline code comments",
      "Record video walkthrough",
    ],
    High: [
      "Add JSDoc/docstring comments",
      "Create module guide",
      "Document key functions",
      "Add usage examples",
    ],
    Medium: [
      "Improve inline comments",
      "Add missing docstrings",
      "Create simple README",
    ],
    Low: [
      "Minor documentation improvements",
      "Add inline comments where needed",
    ],
  },
};

export const DOCUMENTATION_SCORE_WEIGHTS = {
  hasReadmeReference: 15,
  hasJSDoc: 25,
  hasInlineComments: 20,
  hasDependencyInfo: 15,
  hasUsageExamples: 25,
};

export const RISK_SCORE_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};
