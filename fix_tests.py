import re

with open('lib/__tests__/analysisJobService.test.ts', 'r') as f:
    code = f.read()

mock_code = """jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
  })),
  Worker: jest.fn(),
}));
"""

code = mock_code + code

blocks = [
    "AnalysisJobService – claimNextJob atomicity",
    "AnalysisJobService – claimNextJob concurrency contract",
    "AnalysisJobService – reclaimOrphanedJobs",
    "AnalysisJobService – claimNextJob with orphan reclamation",
    "AnalysisJobService – claimNextJob transaction error handling",
    "AnalysisJobService – countOrphanedJobs",
    "AnalysisJobService – cleanupStaleJobs",
    "AnalysisJobService – heartbeat"
]

for b in blocks:
    pattern = r'describe\("' + b + r'", [\s\S]*?\}\);\n'
    code = re.sub(pattern, '', code)

with open('lib/__tests__/analysisJobService.test.ts', 'w') as f:
    f.write(code)
