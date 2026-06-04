# Duplicate Feature Detector

## Overview

The Duplicate Feature Detector is an advanced code analysis tool that identifies duplicated business logic, overlapping implementations, and reusable code extraction opportunities across a repository. It helps maintain code quality and reduce technical debt by finding opportunities for consolidation and abstraction.

## Features

### Code Duplication Detection

- **Multi-Pattern Detection**: Identifies duplicated:
  - Validation logic
  - Authentication handlers
  - API request implementations
  - Error handling code
  - Utility functions
  - Business rules
  - Data transformation logic
  - State management patterns

- **Similarity Analysis**: Uses multiple metrics:
  - AST (Abstract Syntax Tree) comparison
  - Function signature matching
  - Dependency analysis
  - Code pattern recognition
  - Levenshtein distance calculation

### Severity Classification

Issues are classified by severity based on similarity score and frequency:

- **Critical** (high severity)
  - Very similar code (>85% match)
  - Multiple instances (>2)
  - Core functionality affected
  - High maintenance impact

- **Moderate** (medium severity)
  - Similar code (70-85% match)
  - Medium frequency
  - Standard impact

- **Minor** (low severity)
  - Somewhat similar code (<70% match)
  - Few instances
  - Low priority

### Refactor Recommendations

For each cluster of duplicates, the system generates:

- **Title & Description**: Clear explanation of duplication
- **Suggested Module Name**: Recommended name for extracted code
- **Target Location**: Suggested file path for new abstraction
- **Affected Files**: All files containing the duplicate logic
- **Risk Assessment**: Low/Medium/High risk level
- **Implementation Steps**: Detailed refactoring instructions
- **Effort Estimation**: Hours and effort level (low/medium/high)
- **Expected Benefits**: Metrics and improvements expected
- **Potential Risks**: Warnings and considerations

### Confidence Scoring

Similarity scores combine multiple metrics:

```
Overall Score = (
  AST Similarity × 0.4 +
  Function Signature Similarity × 0.2 +
  Dependency Similarity × 0.2 +
  Pattern Similarity × 0.2
)
```

Valid range: 0-100%, threshold default: 70%

## Architecture

### Component Structure

```
src/
├── components/
│   └── repository/
│       └── DuplicateFeatureDetector.tsx       # Main UI component
├── services/
│   └── duplicateFeatureDetectorService.ts    # Service orchestration
├── utils/
│   ├── similarityAnalyzer.ts                 # Similarity calculations
│   ├── duplicateDetection.ts                 # Detection algorithms
│   └── refactorSuggestion.ts                 # Recommendation generation
└── types/
    └── duplicateFeature.ts                   # TypeScript definitions
```

### Data Flow

```
Repository Files
    ↓
extractCodeSnippets()
    ↓
CodeSnippet[]
    ↓
clusterDuplicates()
    ↓
DuplicateCluster[]
    ↓
generateRefactorRecommendations()
    ↓
RefactorRecommendation[]
    ↓
DuplicateFeatureDetector.tsx (Display)
```

## Algorithms

### Similarity Analysis

#### 1. AST Similarity
```typescript
const astSimilarity = calculateASTSimilarity(code1, code2)
// Normalizes whitespace and structure
// Calculates Levenshtein distance on normalized code
// Returns 0-100% similarity
```

#### 2. Function Signature Matching
```typescript
const sig1 = extractFunctionSignature(code1)  // "user, email, password"
const sig2 = extractFunctionSignature(code2)  // "user, email, password"
// Compares parameter names and count
// Returns 0-100% similarity
```

#### 3. Dependency Similarity (Jaccard)
```
Common Dependencies / Union of All Dependencies = Similarity
// Identifies shared imports and variables
// Returns 0-100% similarity
```

#### 4. Pattern Similarity
Detects common code patterns:
- Conditional logic
- Iteration loops
- Error handling
- Async operations
- Ternary operators
- Method calls
- Spread operators
- Function definitions

#### 5. Combined Score
```
Final Score = Weighted Average of All Metrics
Each metric contributes 20-40% to final score
Minimum threshold: 70% (configurable)
```

### Clustering Algorithm

```
for each code snippet:
  if not already processed:
    find all similar snippets (> threshold)
    create cluster with all instances
    mark all as processed
```

Results are sorted by:
1. Average similarity (highest first)
2. Number of instances (most duplicates first)
3. Total lines affected (largest first)

## Configuration

### Detection Config

```typescript
interface DuplicateDetectionConfig {
  minSimilarityThreshold?: number;    // Default: 70
  minLineThreshold?: number;          // Default: 10
  featureTypes?: FeatureType[];       // Filter by type
  excludePatterns?: string[];         // Exclude paths
  analysisDepth?: "quick" | "standard" | "thorough"; // Default: "standard"
}
```

### Usage

```typescript
const analysis = analyzeDuplicateFeatures(repository, {
  minSimilarityThreshold: 80,
  analysisDepth: "thorough",
});
```

## UI Components

### Severity Indicators

- **🔴 Critical**: Highest priority duplicates
- **🟡 Moderate**: Medium priority
- **🔵 Minor**: Low priority

### Cluster Card Features

- **Header**: Feature name with severity badge and similarity score
- **Stats Panel**: 
  - Number of instances
  - Total lines
  - Confidence score
  - Potential savings

- **Affected Files**: Quick list with count
- **Expandable Details**:
  - Feature type
  - Refactor recommendation
  - Implementation steps
  - Expected benefits
  - Code patterns

### Filtering

- **Severity Filter**: All / Critical / Moderate / Minor
- **Real-time Updates**: Instant filtering
- **Statistics**: Live counts per severity

### Actions

- **Copy Details**: Export cluster information
- **Expand**: View full details and recommendations

## Type Definitions

### DuplicateCluster

```typescript
interface DuplicateCluster {
  id: string;                       // Unique cluster ID
  featureName: string;              // "Validation Logic - auth.ts"
  featureType: FeatureType;         // Type of duplicated logic
  description: string;              // Explanation
  instances: CodeSnippet[];         // All occurrences
  matches: SimilarityMatch[];        // Pairwise comparisons
  averageSimilarity: number;        // 0-100
  totalLines: number;               // Lines affected
  potentialSavings: number;         // Estimated reduction
  confidence: number;               // 0-100
  severity: "low" | "medium" | "high";
}
```

### RefactorRecommendation

```typescript
interface RefactorRecommendation {
  clusterId: string;
  title: string;                    // "Extract Shared Validation Utility"
  description: string;
  extractedName: string;            // "validators"
  targetLocation?: string;          // "src/utils/validators.ts"
  affectedFiles: string[];
  estimatedLinesReduced: number;
  estimatedComplexityReduction: number;  // %
  dependencies: string[];
  riskLevel: "low" | "medium" | "high";
  implementationSteps: string[];
  estimatedEffort: "low" | "medium" | "high";
  estimatedHours: number;
  expectedBenefits: string[];
  potentialRisks: string[];
}
```

## Metrics & Analytics

### Duplicate Metrics

```typescript
{
  totalClusters: number;           // Number of duplicate groups
  totalDuplicates: number;         // Total duplicate instances
  totalAffectedFiles: number;      // Files with duplicates
  totalDuplicatedLines: number;    // Lines of duplicated code
  averageClusterSimilarity: number; // Average match %
  potentialSavingsPercentage: number; // Estimated % reduction
  technicalDebtReduction: number;  // Estimated improvement
}
```

### Code Quality Indicators

- **Duplication Index**: % of code that's duplicated
- **Technical Debt Estimate**: Impact if left unrefactored
- **Refactor Priority**: Based on severity and impact
- **Time Savings**: Estimated hours saved by extracting

## Examples

### Example 1: Validation Logic

**Before** (3 instances, ~45 lines duplicated):
```typescript
// auth.ts
const validateEmail = (email: string) => {
  if (!email) return false;
  if (!email.includes('@')) return false;
  return true;
};

// profile.ts
const validateUserEmail = (email: string) => {
  if (!email) return false;
  if (!email.includes('@')) return false;
  return true;
};

// settings.ts
const isValidEmail = (email: string) => {
  if (!email) return false;
  if (!email.includes('@')) return false;
  return true;
};
```

**Recommendation**:
- **Title**: Extract Shared Validation Utility
- **Target**: `src/utils/validators.ts`
- **Effort**: 2 hours (low)
- **Risk**: Low
- **Savings**: ~30 lines
- **Complexity Reduction**: 85%

**After** (single shared validator):
```typescript
// src/utils/validators.ts
export const validateEmail = (email: string): boolean => {
  if (!email || !email.includes('@')) return false;
  return true;
};

// All files import and use same validator
import { validateEmail } from '@/utils/validators';
```

### Example 2: API Request Handlers

**Detection**: Found 4 similar API call patterns
- Similar error handling (92% match)
- Same retry logic (88% match)
- Duplicate response formatting (85% match)

**Recommendation**:
- **Title**: Build API Client Abstraction
- **Target**: `src/services/apiClient.ts`
- **Effort**: 4 hours (medium)
- **Risk**: Medium
- **Savings**: ~120 lines
- **Complexity Reduction**: 75%
- **Benefits**:
  - Centralized error handling
  - Consistent retry logic
  - Unified response formatting

## Best Practices

### For Developers

1. **Review Recommendations**: Not all duplicates should be extracted
2. **Consider Use Cases**: Differences may be intentional
3. **Test Thoroughly**: Refactoring requires comprehensive testing
4. **Document Changes**: Update related documentation
5. **Monitor Performance**: Measure impact of extractions

### For Maintainers

1. **Priority by Severity**: Focus on critical duplicates first
2. **Quick Wins**: Extract low-risk, high-impact duplicates early
3. **Risk Management**: Monitor integration of extracted code
4. **Gradual Refactoring**: Don't refactor everything at once
5. **Feedback Loop**: Measure effectiveness and adjust

## Limitations

- **Simple Pattern Matching**: Not full semantic analysis
- **False Positives**: Intentional duplication not always detected
- **Context Awareness**: Doesn't understand business context
- **Language Support**: Optimized for TypeScript/JavaScript
- **Performance**: Large repositories may take longer

## Future Enhancements

### Phase 2
- AST Visualization with interactive tree view
- Git history analysis for duplicate evolution
- Integration with code review workflow

### Phase 3
- Machine learning for smarter duplicate detection
- AI-powered refactoring suggestions
- Impact analysis before refactoring

### Phase 4
- Automated refactoring with code generation
- Continuous duplicate detection in CI/CD
- Technical debt dashboard integration

## Performance

- **Analysis Time**: O(n²) where n = number of snippets
- **Memory Usage**: O(n) for storing analysis results
- **Caching**: Results cached for 1 hour
- **Lazy Loading**: Details load on expansion

## Testing

### Unit Tests

```typescript
// similarityAnalyzer.test.ts
describe('analyzeSimilarity', () => {
  it('should detect identical code', () => { ... });
  it('should score high similarity', () => { ... });
  it('should detect different patterns', () => { ... });
});

// duplicateDetection.test.ts
describe('clusterDuplicates', () => {
  it('should find duplicate clusters', () => { ... });
  it('should group similar code', () => { ... });
  it('should respect thresholds', () => { ... });
});

// refactorSuggestion.test.ts
describe('generateRefactorRecommendations', () => {
  it('should create valid recommendations', () => { ... });
  it('should estimate effort correctly', () => { ... });
  it('should assess risk levels', () => { ... });
});
```

## API Reference

### `analyzeDuplicateFeatures(repository, config?)`

Main entry point for duplicate detection.

**Parameters:**
- `repository: RepositoryMetadata` - Repository to analyze
- `config?: DuplicateDetectionConfig` - Optional configuration

**Returns:** `RepositoryDuplicateAnalysis`

### `getDuplicateStats(repository)`

Get statistics for UI display.

**Returns:**
```typescript
{
  hasIssues: boolean;
  criticalDuplicates: number;
  moderateDuplicates: number;
  minorDuplicates: number;
  totalDuplicates: number;
  totalAffectedFiles: number;
  potentialImprovements: string[];
  recommendations: RefactorRecommendation[];
}
```

## Troubleshooting

### No Duplicates Detected

- **Threshold too high**: Lower minSimilarityThreshold
- **Small codebase**: Might not have enough code to detect patterns
- **Different patterns**: Code might be intentionally different

### Too Many False Positives

- **Increase threshold**: Raise minSimilarityThreshold to 80-90
- **Filter by type**: Use featureTypes config option
- **Exclude patterns**: Add excludePatterns for test files, etc.

### Performance Issues

- **Large repository**: Use "quick" analysisDepth
- **Many files**: Focus on specific directories
- **Enable caching**: Results are cached by default

## Contributing

To extend the Duplicate Feature Detector:

1. Add new feature type in `duplicateFeature.ts`
2. Create detection function in `duplicateDetection.ts`
3. Add refactor template in `refactorSuggestion.ts`
4. Test with sample repositories
5. Document the new feature type

## License

Same as GitVerse project.
