import { NextRequest, NextResponse } from "next/server";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import {
  createReviewPolicy,
  listReviewPolicies,
  updateReviewPolicy,
  deleteReviewPolicy,
  type ReviewPolicyRule,
} from "@/lib/services/reviewPolicyService";
import prisma from "@/lib/prisma";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json(
        { error: "repositoryId is required" },
        { status: 400 }
      );
    }

    const permission = await enforceRepositoryPermission(request, Number(repositoryId), 'read');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const policies = await listReviewPolicies(Number(repositoryId));
    return NextResponse.json({ policies }, { status: 200 });
  } catch (error: any) {
    console.error("Review policies query error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to query review policies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, name, description, rules } = body;

    if (!repositoryId || !name || !rules) {
      return NextResponse.json(
        { error: "repositoryId, name, and rules are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json(
        { error: "rules must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate rules structure
    for (const rule of rules) {
      if (!rule.rule || !rule.severity) {
        return NextResponse.json(
          { error: "Each rule must have 'rule' and 'severity' fields" },
          { status: 400 }
        );
      }
      if (!["critical", "high", "medium", "low"].includes(rule.severity)) {
        return NextResponse.json(
          { error: "severity must be one of: critical, high, medium, low" },
          { status: 400 }
        );
      }
    }

    const permission = await enforceRepositoryPermission(request, Number(repositoryId), 'write');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const policy = await createReviewPolicy({
      repositoryId: Number(repositoryId),
      name,
      description,
      rules: rules as ReviewPolicyRule[],
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error: any) {
    console.error("Review policy creation error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create review policy" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { policyId, repositoryId, name, description, rules, enabled } = body;

    if (!policyId || !repositoryId) {
      return NextResponse.json(
        { error: "policyId and repositoryId are required" },
        { status: 400 }
      );
    }

    // Validate rules if provided
    if (rules !== undefined) {
      if (!Array.isArray(rules) || rules.length === 0) {
        return NextResponse.json(
          { error: "rules must be a non-empty array" },
          { status: 400 }
        );
      }

      for (const rule of rules) {
        if (!rule.rule || !rule.severity) {
          return NextResponse.json(
            { error: "Each rule must have 'rule' and 'severity' fields" },
            { status: 400 }
          );
        }
        if (!["critical", "high", "medium", "low"].includes(rule.severity)) {
          return NextResponse.json(
            { error: "severity must be one of: critical, high, medium, low" },
            { status: 400 }
          );
        }
      }
    }

    const permission = await enforceRepositoryPermission(request, Number(repositoryId), 'write');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const policy = await updateReviewPolicy({
      policyId: Number(policyId),
      repositoryId: Number(repositoryId),
      name,
      description,
      rules,
      enabled,
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ policy }, { status: 200 });
  } catch (error: any) {
    console.error("Review policy update error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update review policy" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get("policyId");
    const repositoryId = searchParams.get("repositoryId");

    if (!policyId || !repositoryId) {
      return NextResponse.json(
        { error: "policyId and repositoryId are required" },
        { status: 400 }
      );
    }

    const permission = await enforceRepositoryPermission(request, Number(repositoryId), 'write');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const deleted = await deleteReviewPolicy({
      policyId: Number(policyId),
      repositoryId: Number(repositoryId),
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Review policy deletion error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete review policy" },
      { status: 500 }
    );
  }
}
