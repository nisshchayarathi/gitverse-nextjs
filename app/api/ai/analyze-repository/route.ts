import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { repositoryId, type } = body;

    console.log("[RunAnalysis] Started", {
      userId: user.userId,
      repositoryId,
      type,
    });

    if (!repositoryId || !type) {
      return NextResponse.json(
        { error: "Repository ID and analysis type are required" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.getRepository(
      repositoryId,
      user.userId
    );

    if (!repository) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Build lightweight context (efficiency improvement)
    const context = {
      languages: repository.languages?.map((l: any) => ({
        name: l.name,
        percentage: l.percentage,
      })) || [],

      contributors: repository.contributors?.map((c: any) => ({
        name: c.name,
        commits: c.commits,
      })) || [],

      commits: repository.commits?.slice(0, 10).map((c: any) => ({
        message: c.message,
        author: c.authorName,
        date: c.committedAt?.toISOString(),
      })) || [],
    };

    console.log("[RunAnalysis] Context prepared", {
      languages: context.languages.length,
      contributors: context.contributors.length,
      commits: context.commits.length,
    });

    // Timeout safety for Vercel (important improvement)
    const analysisPromise = getGeminiService().analyzeRepository({
      repositoryId,
      type,
      context,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Analysis timeout exceeded")), 25000)
    );

    const analysis = await Promise.race([
      analysisPromise,
      timeoutPromise,
    ]);

    const duration = Date.now() - startTime;

    console.log("[RunAnalysis] Completed", {
      repositoryId,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      analysis,
      type,
      meta: {
        duration,
        success: true,
      },
    });


  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error("[RunAnalysis] Failed", {
      error: error?.message,
      duration: `${duration}ms`,
    });

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to analyze repository",
        meta: {
          duration,
          success: false,
        },
      },
      { status: 500 }
    );

  } finally {
    const duration = Date.now() - startTime;

    console.log({
      route: "POST /api/ai/analyze-repository",
      duration_ms: duration,
      status: "completed"
    });
  }
}