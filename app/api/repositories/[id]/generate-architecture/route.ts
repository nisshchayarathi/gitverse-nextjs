import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await requireAuth(request);

        // Strict ID validation: only digits allowed
        if (!/^\d+$/.test(params.id)) {
            return NextResponse.json({ error: "Invalid repository ID format" }, { status: 400 });
        }

        const id = parseInt(params.id);

        const repository = await repositoryService.getRepository(id, user.userId);
        if (!repository) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        // Limit files to avoid huge context payloads for prompt
        const flatFiles = repository.files || [];
        const contextFiles = flatFiles.slice(0, 100).map((f: any) => ({
            path: f.path || f,
            content: "" // We omit content to save tokens on architecture overview
        }));

        const geminiService = getGeminiService();

        let aiResponse = await geminiService.analyzeRepository({
            repositoryId: id,
            type: "architecture-document",
            context: {
                fileTree: contextFiles.map((f: any) => f.path).join("\n"),
                commits: (repository.commits || []).slice(0, 50),
                languages: (repository.languages || []).slice(0, 20),
                contributors: (repository.contributors || []).slice(0, 20)
            }
        });

        // Remove any markdown code fences (```markdown, ```md, or ```) from the start/end
        aiResponse = aiResponse
            .replace(/^[\s\n]*```(?:markdown|md)?[\s\n]*/i, "")
            .replace(/[\s\n]*```[\s\n]*$/i, "")
            .trim();

        return new NextResponse(aiResponse, {
            status: 200,
            headers: {
                "Content-Type": "text/markdown",
                "Cache-Control": "no-store",
            },
        });

    } catch (error: any) {
        console.error("Error generating architecture doc:", sanitizeError(error));

        if (isHttpError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        return NextResponse.json(
            { error: "Failed to generate architecture document" },
            { status: 500 }
        );
    }
}
