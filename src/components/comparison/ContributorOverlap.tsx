import React, { useState } from "react";
import { Users, User, ArrowRight, Sparkles } from "lucide-react";

interface Contributor {
  name: string;
  email?: string;
  commits: number;
}

interface DetailedRepo {
  id: number;
  name: string;
  contributors: Contributor[];
}

interface ContributorOverlapProps {
  repos: DetailedRepo[];
}

export function ContributorOverlap({ repos }: ContributorOverlapProps) {
  const [activeTab, setActiveTab] = useState<"shared" | "unique">("shared");

  // Helper to normalize strings for comparison
  const normalize = (str: string) => str.toLowerCase().trim();

  // Helper to get identifier (email, or lowercase name as fallback)
  const getIdentifier = (c: Contributor) => {
    return c.email ? normalize(c.email) : normalize(c.name);
  };

  // 1. Map each contributor identifier to their details across repositories
  const allContributorsMap = new Map<
    string,
    {
      name: string;
      email?: string;
      repoCommits: { [repoId: number]: number };
      repoPresence: Set<number>;
    }
  >();

  repos.forEach((repo) => {
    repo.contributors?.forEach((c) => {
      const id = getIdentifier(c);
      const existing = allContributorsMap.get(id);

      if (existing) {
        existing.repoCommits[repo.id] = c.commits;
        existing.repoPresence.add(repo.id);
        // Keep the longest/nicer name if they differ
        if (c.name.length > existing.name.length) {
          existing.name = c.name;
        }
      } else {
        allContributorsMap.set(id, {
          name: c.name,
          email: c.email,
          repoCommits: { [repo.id]: c.commits },
          repoPresence: new Set([repo.id]),
        });
      }
    });
  });

  const allContributorsList = Array.from(allContributorsMap.values());

  // 2. Classify contributors
  const sharedContributors = allContributorsList.filter(
    (c) => c.repoPresence.size >= 2
  );
  
  const uniqueContributorsByRepo = repos.map((repo) => {
    return {
      repoId: repo.id,
      repoName: repo.name,
      contributors: allContributorsList.filter(
        (c) => c.repoPresence.size === 1 && c.repoPresence.has(repo.id)
      ),
    };
  });

  // Total unique contributors across all repos
  const totalUniqueCount = uniqueContributorsByRepo.reduce(
    (acc, curr) => acc + curr.contributors.length,
    0
  );

  return (
    <div className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden group hover:border-border hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contributor Overlap
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify shared contributors and analyze developer contribution patterns.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 border border-border/50 rounded-lg p-0.5 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab("shared")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "shared"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Shared ({sharedContributors.length})
          </button>
          <button
            onClick={() => setActiveTab("unique")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "unique"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unique ({totalUniqueCount})
          </button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass border border-border/30 rounded-xl p-4 text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Total Contributors
          </span>
          <span className="text-2xl font-bold text-foreground">
            {allContributorsList.length}
          </span>
        </div>

        <div className="glass border border-border/30 rounded-xl p-4 text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Shared Developers
          </span>
          <span className="text-2xl font-bold text-primary">
            {sharedContributors.length}
          </span>
        </div>

        {repos.map((repo, idx) => {
          const uniqueCount = uniqueContributorsByRepo.find(
            (u) => u.repoId === repo.id
          )?.contributors.length || 0;
          
          return (
            <div key={repo.id} className="glass border border-border/30 rounded-xl p-4 text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block truncate">
                Unique to {repo.name}
              </span>
              <span className="text-2xl font-bold text-foreground">
                {uniqueCount}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === "shared" ? (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-white/5">
          {sharedContributors.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Sparkles className="h-6 w-6 text-muted-foreground/50" />
              <p>No contributors are shared between these repositories.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-white/5 text-muted-foreground font-semibold">
                    <th className="p-4">Developer</th>
                    {repos.map((repo) => (
                      <th key={repo.id} className="p-4 text-right">
                        Commits in {repo.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sharedContributors.map((c, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-medium text-foreground flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[10px]">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{c.name}</p>

                        </div>
                      </td>
                      {repos.map((repo) => {
                        const commits = c.repoCommits[repo.id] || 0;
                        return (
                          <td key={repo.id} className="p-4 text-right font-semibold text-foreground">
                            {commits > 0 ? (
                              <span className="text-primary font-bold">{commits}</span>
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {uniqueContributorsByRepo.map((item) => (
            <div key={item.repoId} className="border border-border/50 rounded-xl overflow-hidden bg-white/5">
              <div className="p-3 bg-white/5 border-b border-border/50 font-bold text-xs text-foreground truncate">
                {item.repoName} ({item.contributors.length})
              </div>
              <div className="divide-y divide-border/30 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {item.contributors.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No unique contributors.
                  </div>
                ) : (
                  item.contributors.slice(0, 10).map((c, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {c.name}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {c.repoCommits[item.repoId]} commits
                      </span>
                    </div>
                  ))
                )}
                {item.contributors.length > 10 && (
                  <div className="p-2 text-center text-[10px] text-muted-foreground">
                    + {item.contributors.length - 10} more unique contributors
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
