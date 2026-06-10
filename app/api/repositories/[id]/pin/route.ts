import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH /api/repositories/:id/pin — toggle pin state
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const repoId = parseInt(params.id, 10);

    if (isNaN(repoId) || repoId <= 0) {
      return NextResponse.json(
        { message: "Invalid repository ID" },
        { status: 400 },
      );
    }

    // Verify repo belongs to user
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId: user.userId },
      select: { id: true, isPinned: true },
    });

    if (!repo) {
      return NextResponse.json(
        { message: "Repository not found" },
        { status: 404 },
      );
    }

    // Toggle pin state
    const newPinnedState = !repo.isPinned;

    const updated = await prisma.repository.update({
      where: { id: repoId },
      data: {
        isPinned: newPinnedState,
        pinnedAt: newPinnedState ? new Date() : null,
      },
      select: {
        id: true,
        isPinned: true,
        pinnedAt: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt,
    });
  } catch (error: any) {
    console.error("Error toggling pin:", sanitizeError(error));
    return NextResponse.json(
      { message: "Failed to toggle pin" },
      { status: 500 },
    );
  }
}
