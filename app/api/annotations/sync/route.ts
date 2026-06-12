import { NextRequest, NextResponse } from "next/server";

import { isHttpError, requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { addClient, removeClient } from "@/lib/services/annotationSync";

/**
 * Opens a server-sent event stream that mirrors annotation-signal updates
 * for a repository owned by the authenticated user.
 *
 * Requires a positive integer `repositoryId` query parameter that resolves
 * to a repository owned by the caller. Returns 400 for malformed or missing
 * IDs, 401/403 for auth or ownership failures, and a `text/event-stream`
 * response on success.
 *
 * @param request - The incoming Next.js request.
 * @returns A response that either carries a JSON error or an SSE stream
 *   that the client can subscribe to for live annotation updates.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json(
        { error: "Missing repositoryId" },
        { status: 400 },
      );
    }

    const parsedRepositoryId = Number.parseInt(repositoryId, 10);
    if (!Number.isInteger(parsedRepositoryId) || parsedRepositoryId <= 0) {
      return NextResponse.json(
        { error: "Invalid repositoryId" },
        { status: 400 },
      );
    }

    const repository = await prisma.repository.findFirst({
      where: {
        id: parsedRepositoryId,
        userId: user.userId,
      },
      select: { id: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found or access denied" },
        { status: 403 },
      );
    }

    const repositoryKey = repository.id.toString();
    const clientId = crypto.randomUUID();

    const stream = new ReadableStream({
      start(controller) {
        addClient(repositoryKey, { id: clientId, controller });
      },
      cancel() {
        removeClient(repositoryKey, clientId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to open annotation sync stream", error);
    return NextResponse.json(
      { error: "Failed to open annotation sync stream" },
      { status: 500 },
    );
  }
}
