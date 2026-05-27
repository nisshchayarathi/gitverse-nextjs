import { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import RepositoryAnalysis from '@/pages/RepositoryAnalysis'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = params.id
  // Format repository name beautifully
  const repoName = id
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gitverse.dev"
  const ogImageUrl = `${appUrl}/api/og?title=${encodeURIComponent(`${repoName} Analysis`)}`

  return {
    title: `${repoName} - AI Repository Analysis`,
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
  }
}

export default function RepoPage() {
  return (
    <ProtectedRoute>
      <RepositoryAnalysis />
    </ProtectedRoute>
  )
}
