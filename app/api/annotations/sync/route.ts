import { NextRequest } from "next/server";

import { addClient, removeClient } from "@/lib/services/annotationSync";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import { requireAuth, isHttpError } from "@/lib/middleware";
import { RepositoryAccess } from "../../../../services/authz/repository-access";

export async function GET(request: NextRequest) {
  // Extract token from query parameter if present to support EventSource connections
  const token = request.nextUrl.searchParams.get("token");
  if (token) {
    request.headers.set("authorization", `Bearer ${token}`);
  }

  // 1. Authenticate user
  let user;
  try {
    user = await requireAuth(request);
  } catch (error: any) {
    if (isHttpError(error)) {
      return new Response(error.message, { status: error.status });
    }
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Validate repositoryId input
  const searchParams = request.nextUrl.searchParams;
  const repositoryIdStr = searchParams.get("repositoryId");

  if (!repositoryIdStr) {
    return new Response("Missing repositoryId", { status: 400 });
  }

  const repositoryId = Number(repositoryIdStr);
  if (!Number.isFinite(repositoryId) || !Number.isInteger(repositoryId)) {
    return new Response("Invalid repositoryId", { status: 400 });
  }

  const canonicalRepoId = String(repositoryId);

  // 3. Authorize repository access
  const access = await RepositoryAccess.checkAccess(repositoryId, user.userId);
  if (!access.allowed) {
    if (access.repositoryExists === false) {
      return new Response("Repository not found", { status: 404 });
    }
    return new Response("Forbidden: Access denied", { status: 403 });
  }

  // 4. Check rate limiting (keyed on user ID)
  const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ANNOTATION_SYNC);
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Too many sync connections");
  }

  // 5. Establish SSE Stream
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      addClient(canonicalRepoId, { id: clientId, controller });
    },
    cancel() {
      removeClient(canonicalRepoId, clientId);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
