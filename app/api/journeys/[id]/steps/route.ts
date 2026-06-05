import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { LearningPathGenerator } from "@/lib/services/learningPathGenerator";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const journeyId = parseInt(params.id);
    const body = await request.json();
    const { stepId } = body;

    if (!stepId) {
      return NextResponse.json(
        { error: "Missing stepId" },
        { status: 400 },
      );
    }

    // Verify journey belongs to user
    const journey = await prisma.contributorJourney.findFirst({
      where: { id: journeyId, userId: user.id },
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Verify step belongs to journey
    const step = await prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
    });

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const pathGenerator = new LearningPathGenerator();
    const result = await pathGenerator.markStepComplete(journeyId, stepId, user.id);

    return NextResponse.json({
      stepId: result.stepId,
      progress: result.progress,
    });
  } catch (error) {
    console.error("Error marking step complete:", error);
    return NextResponse.json(
      { error: "Failed to mark step complete" },
      { status: 500 },
    );
  }
}
