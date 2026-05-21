import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

type RepositoryFile = {
  path: string;
  size: number; // bytes or LOC
  language?: string; // e.g. "TypeScript"
  extension?: string; // e.g. "TypeScript"
};

type RepositoryCommit = {
  shortHash: string;
  message: string;
};

type RepositoryContributor = {
  name: string;
};

type Repository = {
  files: RepositoryFile[];
  commits: RepositoryCommit[];
  contributors: RepositoryContributor[];
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { repositoryId, filePath } = body;

    if (!repositoryId || !filePath) {
      return NextResponse.json(
        { error: "Repository ID and file path are required" },
        { status: 400 }
      );
    }

    const repository = (await repositoryService.getRepository(
      repositoryId,
      user.userId
    )) as Repository;

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const file = repository.files.find((f) => f.path === filePath);

    if (!file) {
      return NextResponse.json(
        { error: "File not found in repository" },
        { status: 404 }
      );
    }

    const explanation = `File: ${file.path}\nSize: ${file.size} bytes\nLanguage: ${file.language || "Unknown"}\n\nThis is a ${file.extension || "file"} in the repository.`;

    return NextResponse.json({
      explanation,
      file: { path: file.path, language: file.language },
    });
  } catch (error: any) {
    console.error("File explanation error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to explain file" },
      { status: 500 }
    );
  }
}
