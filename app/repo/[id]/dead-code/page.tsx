import { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import DeadCodePageClient from "./DeadCodePageClient";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = params.id;
  const repoName = id
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gitverse.dev";
  const ogImageUrl = `${appUrl}/api/og?title=${encodeURIComponent(`${repoName} Dead Code Analysis`)}`;

  return {
    title: `${repoName} - Dead Code Analysis`,
    description: `Find and eliminate unused code in ${repoName} with confidence-scored dead code detection.`,
    openGraph: {
      title: `${repoName} | GitVerse Dead Code Detector`,
      description: `Identify unused exports, components, hooks, and utilities in ${repoName}.`,
      url: `${appUrl}/repo/${id}/dead-code`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${repoName} Dead Code Analysis` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${repoName} | GitVerse Dead Code Detector`,
      description: `Identify unused exports, components, hooks, and utilities in ${repoName}.`,
      images: [ogImageUrl],
    },
  };
}

export default function DeadCodePage() {
  return (
    <ProtectedRoute>
      <DeadCodePageClient />
    </ProtectedRoute>
  );
}
