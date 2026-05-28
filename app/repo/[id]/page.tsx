import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import RepositoryAnalysis from "@/pages/RepositoryAnalysis";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";

interface Props {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return { title: "Repository" };
  }

  try {
    const repo = await prisma.repository.findUnique({
      where: { id },
      select: { name: true },
    });
    if (repo) {
      return { title: repo.name };
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  return { title: "Repository" };
}

export default function RepoPage() {
  return (
    <ProtectedRoute>
      <RepositoryAnalysis />
    </ProtectedRoute>
  );
}
