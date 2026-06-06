import prisma from "@/lib/prisma";
import { sanitizeTextContent } from "@/lib/utils/promptSanitization";

export type ReviewPolicyRule = {
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
};

export type ReviewPolicyData = {
  id: number;
  repositoryId: number;
  name: string;
  description: string | null;
  rules: ReviewPolicyRule[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function createReviewPolicy(params: {
  repositoryId: number;
  name: string;
  description?: string;
  rules: ReviewPolicyRule[];
}): Promise<ReviewPolicyData> {
  const policy = await prisma.reviewPolicy.create({
    data: {
      repositoryId: params.repositoryId,
      name: params.name,
      description: params.description,
      rules: params.rules as any,
    },
  });

  return policy as ReviewPolicyData;
}

export async function updateReviewPolicy(params: {
  policyId: number;
  repositoryId: number;
  name?: string;
  description?: string;
  rules?: ReviewPolicyRule[];
  enabled?: boolean;
}): Promise<ReviewPolicyData | null> {
  const policy = await prisma.reviewPolicy.findFirst({
    where: {
      id: params.policyId,
      repositoryId: params.repositoryId,
    },
  });

  if (!policy) return null;

  const updated = await prisma.reviewPolicy.update({
    where: { id: params.policyId },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.rules !== undefined && { rules: params.rules as any }),
      ...(params.enabled !== undefined && { enabled: params.enabled }),
    },
  });

  return updated as ReviewPolicyData;
}

export async function deleteReviewPolicy(params: {
  policyId: number;
  repositoryId: number;
}): Promise<boolean> {
  const result = await prisma.reviewPolicy.deleteMany({
    where: {
      id: params.policyId,
      repositoryId: params.repositoryId,
    },
  });

  return result.count > 0;
}

export async function getReviewPolicy(params: {
  policyId: number;
  repositoryId: number;
}): Promise<ReviewPolicyData | null> {
  const policy = await prisma.reviewPolicy.findFirst({
    where: {
      id: params.policyId,
      repositoryId: params.repositoryId,
    },
  });

  return policy as ReviewPolicyData | null;
}

export async function listReviewPolicies(
  repositoryId: number,
): Promise<ReviewPolicyData[]> {
  const policies = await prisma.reviewPolicy.findMany({
    where: { repositoryId },
    orderBy: { createdAt: "desc" },
  });

  return policies as ReviewPolicyData[];
}

export async function getActivePoliciesForRepository(
  repositoryId: number,
): Promise<ReviewPolicyData[]> {
  const policies = await prisma.reviewPolicy.findMany({
    where: {
      repositoryId,
      enabled: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return policies as ReviewPolicyData[];
}

export function buildPolicyPromptSection(policies: ReviewPolicyData[]): string {
  if (policies.length === 0) return "";

  const ruleLines: string[] = [];
  for (const policy of policies) {
    if (!policy.rules || !Array.isArray(policy.rules)) continue;
    for (const rule of policy.rules) {
      if (!rule.rule) continue;
      ruleLines.push(`- [${rule.severity.toUpperCase()}] ${sanitizeTextContent(rule.rule)}`);
    }
  }

  if (ruleLines.length === 0) return "";

  return `
ORGANIZATIONAL POLICIES (MUST ENFORCE):
The following custom rules are defined by the repository administrators. You MUST check for compliance with each rule. If a PR violates any rule, create an issue with severity matching the rule's severity level and category set to "policy-violation".

${ruleLines.join("\n")}

IMPORTANT: Policy violations should be flagged with the exact severity specified. Use the "suggestion" field to explain how to fix the violation according to the organizational standard.
`;
}
