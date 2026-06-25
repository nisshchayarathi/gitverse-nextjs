# Duplicate Feature Detector

Overview
- A repository analysis service that scans source files, parses ASTs, and detects duplicated logic patterns across files.

Files added
- `lib/services/duplicateFeatureDetector.ts` — analysis engine exposing `analyzeRepository(rootDir)`
- `app/api/analysis/duplicate-features/route.ts` — API route returning detected features
- `src/components/duplicate/DuplicateFeatureDetectorPanel.tsx` — UI panel to display results

How it works
- Scans common source folders for .ts/.tsx/.js/.jsx files.
- Uses the TypeScript compiler API to parse files and extract functions/methods.
- Normalizes identifiers and serializes AST structure to compute structural similarity.
- Uses heuristics (signature similarity, structural Jaccard, dependency overlap, conditional counts) to compute a confidence score.
- Groups similar functions into detected duplicate features and generates simple recommendations.

Integration
- The API route runs the detector against the repository root (`process.cwd()`). The UI panel fetches that endpoint.
- Designed to be non-invasive — it's a read-only analysis. You can wire the panel into the repository analysis dashboard where desired.

Notes & Future work
- Currently uses heuristics to detect similarity; swapping in an AI model or more advanced graph algorithms later is straightforward.
- Future additions: one-click extraction refactors, suggested code transforms, deeper dependency graph integration.
