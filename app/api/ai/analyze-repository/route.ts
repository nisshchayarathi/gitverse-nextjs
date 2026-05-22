import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { AnalysisTimeoutError } from "@/lib/errors/AnalysisTimeoutError";
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

function buildContext(
  repository: Awaited<ReturnType<typeof repositoryService.getRepository>>
): RepositoryContext {
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
      repository.commits
        ?.slice(0, MAX_COMMITS)
        .map((c: { message: string; authorName: string; committedAt?: Date }) => ({
          message: c.message,
          author: c.authorName,
          date: c.committedAt?.toISOString(),
        })) ?? [],
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();
  const noStoreHeaders = { "Cache-Control": "no-store" as const };

  const duration = () => Date.now() - startTime;

  const errorResponse = (
    message: string,
    status: number
  ): NextResponse<ErrorResponse> =>
    NextResponse.json(
      { error: message, meta: { duration: duration(), success: false } },
      { status, headers: noStoreHeaders }
    );

  try {
    const user = await requireAuth(request);
    let repositoryId: unknown;
    let type: unknown;

    try {
      const body: unknown = await request.json();

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        log.warn("validation_failed", { reason: "non_object_body", userId: user.userId });
        return errorResponse("Request body must be a JSON object", 400);
      }

      ({ repositoryId, type } = body as Record<string, unknown>);
    } catch {
      log.warn("validation_failed", { reason: "malformed_json", userId: user.userId });
      return errorResponse("Request body is not valid JSON", 400);
    }

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
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();                          // cancels the Gemini SDK request
        reject(new AnalysisTimeoutError());
      }, ANALYSIS_TIMEOUT_MS);
    });

    let analysis: unknown;
    try {
      const analysisPromise = getGeminiService().analyzeRepository({
        repositoryId,
        type,
        context,
        signal: controller.signal,                  // GeminiService forwards this to generateContent()
      });
      analysis = await Promise.race([analysisPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);                   // prevents timer leak on the success path
    }

    log.info("analysis_completed", { repositoryId, type, userId: user.userId, duration: duration() });

    return NextResponse.json(
      { analysis, type, meta: { duration: duration(), success: true } },
      { status: 200, headers: noStoreHeaders }
    );

  } catch (error: unknown) {

    if (isHttpError(error)) {
      const is403 = error.status === 403;
      const status = is403 ? 404 : error.status;
      // Remap 403 message too — returning the real reason under a 404 status
      // still leaks that the resource exists but access was denied.
      const message = is403 ? "Resource not found" : error.message;
      log.warn("http_error", { originalStatus: error.status, status, message: error.message });
      return errorResponse(message, status);
    }

    const isTimeout = error instanceof AnalysisTimeoutError;
    const message = error instanceof Error ? error.message : "Unknown error";

    log.error("unhandled_error", { message, isTimeout, duration: duration() });

    return errorResponse(
      isTimeout ? "Analysis timed out. Please try again." : "Failed to analyze repository",
      isTimeout ? 504 : 500
    );
  }
}