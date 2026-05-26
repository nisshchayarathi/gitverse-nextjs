import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const jobs = await prisma.analysisJob.findMany({
      where: {
        repositoryId: Number(params.id),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch analysis history" },
      { status: 500 },
    );
  }
}