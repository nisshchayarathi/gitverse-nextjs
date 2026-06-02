import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { broadcastAnnotationEvent } from "@/lib/services/annotationSync";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json({ error: "repositoryId is required" }, { status: 400 });
    }

    const annotations = await prisma.mapAnnotation.findMany({
      where: {
        repositoryId: parseInt(repositoryId),
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(annotations);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch annotations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { repositoryId, targetType, targetId, content, annotationType, positionX, positionY } = body;

    if (!repositoryId || !targetType || !targetId || !content || !annotationType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user has access to repo (simple check, assume requireAuth is sufficient or add repo ownership check)
    const repo = await prisma.repository.findFirst({
      where: {
        id: parseInt(repositoryId),
        userId: user.userId, // Or organization access check if applicable
      }
    });

    if (!repo) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 403 });
    }

    const annotation = await prisma.mapAnnotation.create({
      data: {
        repositoryId: parseInt(repositoryId),
        authorId: user.userId,
        targetType,
        targetId,
        content,
        annotationType,
        positionX,
        positionY,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      }
    });

    await prisma.annotationActivity.create({
      data: {
        annotationId: annotation.id,
        userId: user.userId,
        action: 'created',
      }
    });

    // Broadcast
    broadcastAnnotationEvent(annotation.repositoryId.toString(), {
      type: 'created',
      annotation
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create annotation", error);
    return NextResponse.json({ error: "Failed to create annotation" }, { status: 500 });
  }
}
