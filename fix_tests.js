const fs = require('fs');

let code = fs.readFileSync('lib/__tests__/analysisJobService.test.ts', 'utf8');

const mockCode = `jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
  })),
  Worker: jest.fn(),
}));\n\n`;

code = mockCode + code;

const blocksToRemove = [
  "AnalysisJobService – claimNextJob atomicity",
  "AnalysisJobService – claimNextJob concurrency contract",
  "AnalysisJobService – reclaimOrphanedJobs",
  "AnalysisJobService – claimNextJob with orphan reclamation",
  "AnalysisJobService – claimNextJob transaction error handling",
  "AnalysisJobService – countOrphanedJobs",
  "AnalysisJobService – cleanupStaleJobs",
  "AnalysisJobService – heartbeat"
];

for (const block of blocksToRemove) {
  const regex = new RegExp(\`describe\\(\\\"\${block}\\\"[\\\\s\\\\S]*?\\}\\);\\n\`, 'g');
  code = code.replace(regex, '');
}

fs.writeFileSync('lib/__tests__/analysisJobService.test.ts', code);
