import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { LearningPathGenerator } from "@/lib/services/learningPathGenerator";
import { authOptions } from "@/lib/auth";

export async function GET(
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
    const pathGenerator = new LearningPathGenerator();
    const journey = await pathGenerator.getJourney(user.id, journeyId);

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    return NextResponse.json({ journey });
  } catch (error) {
    console.error("Error fetching journey:", error);
    return NextResponse.json(
      { error: "Failed to fetch journey" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const { progress, status } = body;

    // Verify journey belongs to user
    const journey = await prisma.contributorJourney.findFirst({
      where: { id: journeyId, userId: user.id },
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const pathGenerator = new LearningPathGenerator();
    const updated = await pathGenerator.updateJourneyProgress(
      journeyId,
      user.id,
      progress ?? 0,
    );

    return NextResponse.json({ journey: updated });
  } catch (error) {
    console.error("Error updating journey:", error);
    return NextResponse.json(
      { error: "Failed to update journey" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    // Verify journey belongs to user
    const journey = await prisma.contributorJourney.findFirst({
      where: { id: journeyId, userId: user.id },
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Delete all steps first
    await prisma.journeyStep.deleteMany({
      where: { journeyId },
    });

    // Delete journey
    await prisma.contributorJourney.delete({
      where: { id: journeyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting journey:", error);
    return NextResponse.json(
      { error: "Failed to delete journey" },
      { status: 500 },
    );
  }
}
