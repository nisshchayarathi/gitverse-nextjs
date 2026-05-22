"use client";

import { useMemo } from "react";
import { AIRepoMentorSection } from "@/components/ai/AIRepoMentorSection";

export function RepositoryMentorTab(props: { repositoryData?: any }) {
  const repositoryData = props.repositoryData;

  const repoName: string = repositoryData?.name || "Unknown";
  const description: string | undefined =
    repositoryData?.description || undefined;

  const languageNames = useMemo(
    () =>
      (repositoryData?.languages || [])
        .map((l: any) => l?.name)
        .filter(Boolean),
    [repositoryData?.languages],
  );

  const readmeText: string | null = repositoryData?.readmeText ?? null;

  const contributors = useMemo(() => {
    const raw = Array.isArray(repositoryData?.contributors)
      ? repositoryData.contributors
      : [];
    return raw.map((c: any) => ({
      name: c?.name ?? c?.authorName ?? null,
      email: c?.email ?? c?.authorEmail ?? null,
      commits:
        typeof c?.commits === "number" ? c.commits : Number(c?.commits ?? 0),
      additions:
        typeof c?.additions === "number"
          ? c.additions
          : Number(c?.additions ?? 0),
      deletions:
        typeof c?.deletions === "number"
          ? c.deletions
          : Number(c?.deletions ?? 0),
    }));
  }, [repositoryData?.contributors]);

  return (
    <div className="space-y-6">
      <AIRepoMentorSection
        repositoryId={Number(repositoryData?.id || 0)}
        repoName={repoName}
        description={description}
        languages={languageNames}
        readmeText={readmeText}
        contributors={contributors}
      />
    </div>
  );
}
