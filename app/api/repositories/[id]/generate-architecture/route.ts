import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import prisma from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await requireAuth(request);
        const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.REPOSITORY_ARCHITECTURE);
        if (!rl.allowed) return rateLimitResponse(rl);

        if (!/^\d+$/.test(params.id)) {
            return NextResponse.json({ error: "Invalid repository ID format" }, { status: 400 });
        }

        const id = parseInt(params.id);

        const repository = await repositoryService.getRepository(id, user.userId);
        if (!repository) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        // Create the background job for architecture generation
        const job = await analysisJobService.createArchitectureGenerationJob({
            repositoryId: id,
            userId: user.userId,
        });

        // Trigger worker asynchronously
        triggerAnalysisWorkerWorkflow().catch((err) => {
            console.error("Failed to trigger background architecture generation worker:", err);
        });

        return NextResponse.json({
            jobId: job.id,
            status: job.status,
            message: "Architecture generation started"
        });

    } catch (error: any) {
        console.error("Error generating architecture doc:", sanitizeError(error));

        if (isHttpError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        return NextResponse.json(
            { error: "Failed to start architecture generation" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await requireAuth(request);

        if (!/^\d+$/.test(params.id)) {
            return NextResponse.json({ error: "Invalid repository ID format" }, { status: 400 });
        }

        const id = parseInt(params.id);

        const repository = await repositoryService.getRepository(id, user.userId);
        if (!repository) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        const knowledge = await prisma.repositoryKnowledge.findUnique({
            where: { repositoryId: id }
        });

        if (!knowledge || !knowledge.projectDescription) {
            return NextResponse.json({ error: "Architecture document not found or still generating" }, { status: 404 });
        }

        return new NextResponse(knowledge.projectDescription, {
            status: 200,
            headers: {
                "Content-Type": "text/markdown",
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        console.error("Error fetching architecture doc:", sanitizeError(error));
        return NextResponse.json(
            { error: "Failed to fetch architecture document" },
            { status: 500 }
        );
    }
}
