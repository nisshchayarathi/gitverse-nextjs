import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { LearningPathGenerator } from "@/lib/services/learningPathGenerator";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const pathGenerator = new LearningPathGenerator();
    const journeys = await pathGenerator.getUserJourneys(user.id);

    return NextResponse.json({ journeys });
  } catch (error) {
    console.error("Error fetching journeys:", error);
    return NextResponse.json(
      { error: "Failed to fetch journeys" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repositoryId, moduleName, goalDescription, targetComplexity, maxSteps, startingPoints } = body;

    if (!repositoryId || !moduleName || !goalDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify repository belongs to user
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId: user.id },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    // Check if file importance data exists
    const importanceData = await prisma.fileImportance.findFirst({
      where: { repositoryId },
    });

    if (!importanceData) {
      return NextResponse.json(
        { error: "Repository not analyzed yet. Please analyze the repository first." },
        { status: 400 },
      );
    }

    const pathGenerator = new LearningPathGenerator();
    const journey = await pathGenerator.generateJourney(repositoryId, {
      moduleName,
      goalDescription,
      targetComplexity: targetComplexity || "INTERMEDIATE",
      maxSteps: maxSteps || 10,
      startingPoints,
    });

    const savedJourney = await pathGenerator.saveJourney(user.id, repositoryId, journey);

    return NextResponse.json({
      journey: {
        id: savedJourney.id,
        moduleName: savedJourney.moduleName,
        goalDescription: savedJourney.goalDescription,
        estimatedDays: savedJourney.estimatedDays,
        progress: savedJourney.progress,
        status: savedJourney.status,
        steps: journey.steps,
      },
    });
  } catch (error) {
    console.error("Error creating journey:", error);
    return NextResponse.json(
      { error: "Failed to create journey", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
