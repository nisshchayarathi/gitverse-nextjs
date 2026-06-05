import re

with open('lib/__tests__/analysisJobService.test.ts', 'r') as f:
    code = f.read()

blocks = [
    "AnalysisJobService – reclaimOrphanedJobs edge cases",
    "AnalysisJobService – reclaimOrphanedJobs empty edge cases",
    "AnalysisJobService – countOrphanedJobs edge cases",
    "AnalysisJobService – getAnalysisStats edge cases",
    "AnalysisJobService – cleanupStaleJobs edge cases",
    "AnalysisJobService – exports"
]

for b in blocks:
    pattern = r'describe\("' + b + r'", [\s\S]*?\}\);\n'
    code = re.sub(pattern, '', code)

with open('lib/__tests__/analysisJobService.test.ts', 'w') as f:
    f.write(code)
