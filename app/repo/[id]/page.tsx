import { Metadata } from 'next';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import RepositoryAnalysis from '@/pages/RepositoryAnalysis';
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return { title: "Repository" };
  }

  let repoName = "Repository";
  try {
    const repo = await prisma.repository.findUnique({
      where: { id },
      select: { name: true },
    });
    if (repo) {
      repoName = repo.name;
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gitverse.dev";
  const ogImageUrl = `${appUrl}/api/og?title=${encodeURIComponent(`${repoName} Analysis`)}`;

  return {
    title: repoName,
    description: `Deep-dive code visualization, structural analysis, dependency maps, and AI PR feedback for ${repoName}.`,
    openGraph: {
      title: `${repoName} | GitVerse Code Analytics`,
      description: `Explore the architecture, contributions, and insights of ${repoName} in real-time.`,
      url: `${appUrl}/repo/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${repoName} Open Graph Visualisation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${repoName} | GitVerse Code Analytics`,
      description: `Explore the architecture, contributions, and insights of ${repoName} in real-time.`,
      images: [ogImageUrl],
    },
  };
}

export default function RepoPage() {
  return (
    <ProtectedRoute>
      <RepositoryAnalysis />
    </ProtectedRoute>
  );
}
