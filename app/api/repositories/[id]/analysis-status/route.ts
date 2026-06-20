import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // max duration for edge/serverless functions if configured

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return apiError(400, "Invalid repository ID");
    }

    const repository = await repositoryService.getRepository(id, user.userId);
    if (!repository) {
      return apiError(404, "Repository not found");
    }

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return apiError(400, "Missing jobId parameter");
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let isClosed = false;

        const checkStatus = async () => {
          if (isClosed) return;

          try {
            const job = await analysisJobService.getJob({
              jobId,
              userId: user.userId,
            });

            if (!job) {
              sendEvent({ status: "FAILED", error: "Job not found" });
              controller.close();
              isClosed = true;
              return;
            }

            sendEvent(job);

            if (job.status === "DONE" || job.status === "FAILED") {
              controller.close();
              isClosed = true;
            } else {
              setTimeout(checkStatus, 2000);
            }
          } catch (error) {
            console.error("Error polling job status:", error);
            sendEvent({ status: "FAILED", error: "Internal error checking job status" });
            controller.close();
            isClosed = true;
          }
        };

        // If the client disconnects, we handle it if possible. NextJS handles abort signals on the request.
        request.signal.addEventListener("abort", () => {
          isClosed = true;
        });

        // Start polling
        checkStatus();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Analysis status error:", sanitizeError(error));
    return apiError(500, "Failed to start analysis status stream");
  }
}
