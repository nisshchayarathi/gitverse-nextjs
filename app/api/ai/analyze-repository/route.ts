import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

const ANALYSIS_TIMEOUT_MS = 25_000;
const MAX_COMMITS = 10;

const VALID_ANALYSIS_TYPES = [
  "overview",
  "security",
  "performance",
  "quality",
  "dependencies",
] as const;

type AnalysisType = (typeof VALID_ANALYSIS_TYPES)[number];



interface LanguageEntry {
  name: string;
  percentage: number;
}

interface ContributorEntry {
  name: string;
  commits: number;
}

interface CommitEntry {
  message: string;
  author: string;
  date: string | undefined;
}

interface RepositoryContext {
  languages: LanguageEntry[];
  contributors: ContributorEntry[];
  commits: CommitEntry[];
}

interface ResponseMeta {
  duration: number;
  success: boolean;
}

interface SuccessResponse {
  analysis: unknown;
  type: AnalysisType;
  meta: ResponseMeta;
}

interface ErrorResponse {
  error: string;
  meta: ResponseMeta;
}


const log = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: "info", event, ...data, ts: new Date().toISOString() })),

  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: "warn", event, ...data, ts: new Date().toISOString() })),

  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "error", event, ...data, ts: new Date().toISOString() })),
};

function isValidAnalysisType(value: string): value is AnalysisType {
  return (VALID_ANALYSIS_TYPES as readonly string[]).includes(value);
}

function buildContext(repository: Awaited<ReturnType<typeof repositoryService.getRepository>>): RepositoryContext {
  return {
    languages:
      repository.languages?.map((l: LanguageEntry) => ({
        name: l.name,
        percentage: l.percentage,
      })) ?? [],

    contributors:
      repository.contributors?.map((c: ContributorEntry) => ({
        name: c.name,
        commits: c.commits,
      })) ?? [],

    commits:
      repository.commits?.slice(0, MAX_COMMITS).map((c: { message: string; authorName: string; committedAt?: Date }) => ({
        message: c.message,
        author: c.authorName,
        date: c.committedAt?.toISOString(),
      })) ?? [],
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();
  const noStoreHeaders = { "Cache-Control": "no-store" };

  const duration = () => Date.now() - startTime;

  const errorResponse = (
    message: string,
    status: number,
    extra?: Record<string, unknown>
  ): NextResponse<ErrorResponse> =>
    NextResponse.json(
      { error: message, meta: { duration: duration(), success: false }, ...extra },
      { status, headers: noStoreHeaders }
    );

  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { repositoryId, type } = body as { repositoryId: unknown; type: unknown };

    if (typeof repositoryId !== "string" || repositoryId.trim() === "") {
      log.warn("validation_failed", { reason: "invalid_repository_id", userId: user.userId });
      return errorResponse("Invalid repository ID", 400);
    }

    if (typeof type !== "string" || type.trim() === "") {
      log.warn("validation_failed", { reason: "missing_analysis_type", userId: user.userId });
      return errorResponse("Analysis type is required", 400);
    }

    if (!isValidAnalysisType(type)) {
      log.warn("validation_failed", {
        reason: "unknown_analysis_type",
        provided: type,
        valid: VALID_ANALYSIS_TYPES,
        userId: user.userId,
      });
      return errorResponse(
        `Invalid analysis type. Must be one of: ${VALID_ANALYSIS_TYPES.join(", ")}`,
        400
      );
    }

    log.info("analysis_started", { repositoryId, type, userId: user.userId });

    const repository = await repositoryService.getRepository(repositoryId, user.userId);

    if (!repository || repository.userId !== user.userId) {
      log.warn("repository_not_found", { repositoryId, userId: user.userId });
      return errorResponse("Repository not found", 404);
    }

    const context = buildContext(repository);

    const analysisPromise = getGeminiService().analyzeRepository({ repositoryId, type, context });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Analysis timeout exceeded")), ANALYSIS_TIMEOUT_MS)
    );

    const analysis = await Promise.race([analysisPromise, timeoutPromise]);

    log.info("analysis_completed", { repositoryId, type, userId: user.userId, duration: duration() });

    return NextResponse.json(
      { analysis, type, meta: { duration: duration(), success: true } },
      { status: 200, headers: noStoreHeaders }
    );

  } catch (error: unknown) {
    if (isHttpError(error)) {
      const status = error.status === 403 ? 404 : error.status;
      log.warn("http_error", { status, message: error.message });
      return errorResponse(error.message, status);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = message === "Analysis timeout exceeded";

    log.error("unhandled_error", { message, isTimeout, duration: duration() });

    return errorResponse(
      isTimeout ? "Analysis timed out. Please try again." : "Failed to analyze repository",
      isTimeout ? 504 : 500
    );
  }
}