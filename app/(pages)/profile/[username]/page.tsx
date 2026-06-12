import ContributionHeatmap from "@/components/visualizations/ContributionHeatmap";

interface Props {
  params: { username: string };
}

export default function ProfilePage({ params }: Props) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">@{params.username}</h1>
      <p className="text-gray-400 mb-6">GitHub Profile</p>

      <ContributionHeatmap username={params.username} />
    </main>
  );
}