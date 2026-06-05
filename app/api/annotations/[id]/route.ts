import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { broadcastAnnotationEvent } from "@/lib/services/annotationSync";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ANNOTATION_WRITE);
    if (!rl.allowed) return rateLimitResponse(rl);
    const id = params.id;
    const body = await request.json();
    const { content, annotationType, positionX, positionY } = body;

    const existing = await prisma.mapAnnotation.findUnique({
      where: { id },
      include: { repository: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    // Only author or repo owner can edit
    if (existing.authorId !== user.userId && existing.repository.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.mapAnnotation.update({
      where: { id },
      data: {
        content: content !== undefined ? content : existing.content,
        annotationType: annotationType !== undefined ? annotationType : existing.annotationType,
        positionX: positionX !== undefined ? positionX : existing.positionX,
        positionY: positionY !== undefined ? positionY : existing.positionY,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      }
    });

    await prisma.annotationActivity.create({
      data: {
        annotationId: updated.id,
        userId: user.userId,
        action: 'updated',
      }
    });

    broadcastAnnotationEvent(updated.repositoryId.toString(), {
      type: 'updated',
      annotation: updated
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update annotation" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ANNOTATION_WRITE);
    if (!rl.allowed) return rateLimitResponse(rl);
    const id = params.id;

    const existing = await prisma.mapAnnotation.findUnique({
      where: { id },
      include: { repository: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
    }

    if (existing.authorId !== user.userId && existing.repository.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Capture repositoryId before deletion for broadcasting
    const repositoryId = existing.repositoryId;

    await prisma.annotationActivity.create({
      data: {
        annotationId: id,
        userId: user.userId,
        action: 'deleted',
      }
    });

    await prisma.mapAnnotation.delete({ where: { id } });

    broadcastAnnotationEvent(repositoryId.toString(), {
      type: 'deleted',
      annotationId: id
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
