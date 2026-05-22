import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositoryId = Number(params.id);

    if (!Number.isInteger(repositoryId) || repositoryId <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400 }
      );
    }

    // Verify ownership
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId: user.userId },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, percentage, bytes, lines } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Language name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Language name cannot be empty or whitespace-only" },
        { status: 400 }
      );
    }

    const language = await prisma.language.create({
      data: {
        name: trimmedName,
        percentage: Number(percentage) || 0,
        bytes: Number(bytes) || 0,
        lines: Number(lines) || 0,
        repositoryId,
      },
    });

    return NextResponse.json(language, { status: 201 });
  } catch (error: any) {
    console.error("Create language error:", error);

    // Handle duplicate entries explicitly
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Language already exists for this repository" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
