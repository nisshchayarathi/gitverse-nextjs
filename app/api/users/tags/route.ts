import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const tags = await prisma.userTag.findMany({
      where: { userId: user.userId },
      include: { _count: { select: { repos: true } } },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json(tags);
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching tags:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const tag = await prisma.userTag.create({
      data: { 
        userId: user.userId, 
        name: name.trim(), 
        color: color ?? '#6366f1' 
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating tag:", sanitizeError(error));
    if (error.code === 'P2002') {
        return NextResponse.json({ error: "Tag with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { id, name, color } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify tag belongs to user
    const existingTag = await prisma.userTag.findUnique({ where: { id } });
    if (!existingTag || existingTag.userId !== user.userId) {
      return NextResponse.json({ error: "Tag not found or unauthorized" }, { status: 404 });
    }

    const tag = await prisma.userTag.update({
      where: { id },
      data: { ...(name && { name: name.trim() }), ...(color && { color }) },
    });

    return NextResponse.json(tag);
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating tag:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify tag belongs to user
    const existingTag = await prisma.userTag.findUnique({ where: { id } });
    if (!existingTag || existingTag.userId !== user.userId) {
      return NextResponse.json({ error: "Tag not found or unauthorized" }, { status: 404 });
    }

    await prisma.userTag.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error deleting tag:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
