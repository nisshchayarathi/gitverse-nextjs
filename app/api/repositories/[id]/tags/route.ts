import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id);

    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

    // Verify repository belongs to user
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository || repository.userId !== user.userId) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const tags = await prisma.repositoryTag.findMany({
      where: { repositoryId },
      include: { tag: true },
    });

    return NextResponse.json(tags.map(rt => rt.tag));
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching repository tags:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id);
    const body = await request.json();
    const { tagIds } = body;

    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
    }

    // Verify repository belongs to user
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository || repository.userId !== user.userId) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // Verify all tagIds belong to user
    if (tagIds.length > 0) {
      const validTags = await prisma.userTag.findMany({
        where: { id: { in: tagIds }, userId: user.userId },
      });
      if (validTags.length !== tagIds.length) {
        return NextResponse.json({ error: "Invalid tag IDs" }, { status: 400 });
      }
    }

    // Update tags using a transaction
    await prisma.$transaction([
      prisma.repositoryTag.deleteMany({ where: { repositoryId } }),
      ...(tagIds.length > 0
        ? [
            prisma.repositoryTag.createMany({
              data: tagIds.map((tagId: string) => ({ repositoryId, tagId })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating repository tags:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to update tags" }, { status: 500 });
  }
}
