"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@/components/ui";
import { CodeDependencyGraph } from "@/components/visualizations/CodeDependencyGraph";
import {
  Sparkles,
  Search,
  ExternalLink,
  Brain,
  Tag,
  Code2,
  AlertCircle,
  HelpCircle,
  FolderDot,
} from "lucide-react";
import { buildApiUrl } from "@/services/apiConfig";

interface IssueMatch {
  id: string | number;
  number: number;
  title: string;
  htmlUrl: string;
  body: string;
  labels: string[];
  score: number;
  matchedFiles: string[];
  reason: string;
}

interface RepositoryIssuesProps {
  repository: any;
}

export function RepositoryIssues({ repository }: RepositoryIssuesProps) {
  const [skills, setSkills] = useState<string>("");
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [issues, setIssues] = useState<IssueMatch[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const predefinedSkills = ["TypeScript", "React", "CSS", "Prisma", "Node.js", "Jest"];

  const getAuthHeaders = () => {
    const token = localStorage.getItem("gitverse_token");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchIssues = async (customSkills?: string) => {
    if (!repository?.id) return;
    setLoading(true);
    setError(null);
    setSelectedIssue(null);
    try {
      const skillsQuery = customSkills || skillsList.join(",");
      const res = await axios.get(
        buildApiUrl(`/api/repositories/${repository.id}/issues`),
        {
          params: { skills: skillsQuery },
          headers: getAuthHeaders(),
        }
      );
      const fetchedIssues = res.data.issues || [];
      setIssues(fetchedIssues);
      if (fetchedIssues.length > 0) {
        setSelectedIssue(fetchedIssues[0]);
      }
    } catch (err: any) {
      console.error("Error fetching good first issues:", err);
      setError(
        err.response?.data?.error || "Failed to load good first issues. Make sure your GitHub integration is healthy."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository?.id]);

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = skills.trim();
    if (trimmed && !skillsList.includes(trimmed)) {
      const nextSkills = [...skillsList, trimmed];
      setSkillsList(nextSkills);
      setSkills("");
      void fetchIssues(nextSkills.join(","));
    }
  };

  const handleRemoveSkill = (skill: string) => {
    const nextSkills = skillsList.filter((s) => s !== skill);
    setSkillsList(nextSkills);
    void fetchIssues(nextSkills.join(","));
  };

  const handleTogglePresetSkill = (skill: string) => {
    let nextSkills;
    if (skillsList.includes(skill)) {
      nextSkills = skillsList.filter((s) => s !== skill);
    } else {
      nextSkills = [...skillsList, skill];
    }
    setSkillsList(nextSkills);
    void fetchIssues(nextSkills.join(","));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (score >= 50) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-900/40 via-violet-950/30 to-slate-900/60 border border-purple-500/20 p-6 sm:p-8">
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            AI-Powered Matcher
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
            Automated &quot;Good First Issue&quot; Matcher
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Connect to open issues, supply your core developer skillset, and GitVerse will automatically pinpoint the exact files and modules you should start hacking in.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient from-purple-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Skills Customizing Card */}
      <Card className="glass border-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
            <Brain className="h-5 w-5 text-purple-400" />
            Tailor Matches to Your Skills
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs sm:text-sm">
            Add your primary technology stack skills to fine-tune AI recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tag input form */}
          <form onSubmit={handleAddSkill} className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Add skill (e.g. TypeScript, Jest)..."
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="pl-9 bg-black/40 border-slate-700 focus:border-purple-500 text-white placeholder-slate-500"
              />
            </div>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-medium">
              Add
            </Button>
          </form>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">Popular Skills:</span>
            {predefinedSkills.map((skill) => {
              const active = skillsList.includes(skill);
              return (
                <button
                  key={skill}
                  onClick={() => handleTogglePresetSkill(skill)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all duration-300 ${
                    active
                      ? "bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-md shadow-purple-500/10"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>

          {/* Active Skills tags */}
          {skillsList.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
              <span className="text-xs text-slate-500 flex items-center font-medium">Your Stack:</span>
              {skillsList.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30"
                >
                  <Tag className="h-3 w-3" />
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-red-400 focus:outline-none transition-colors text-slate-400 ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Split-Pane View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Issues List (40%) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-heading font-semibold text-lg text-white">
              Open Issues
            </h3>
            <span className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded-full">
              {issues.length} Issues Loaded
            </span>
          </div>

          {loading ? (
            <div className="glass rounded-xl p-8 space-y-4 border-slate-800">
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                  <div className="h-3 bg-slate-800 rounded w-5/6" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="glass rounded-xl p-8 border border-red-500/20 bg-red-500/5 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
              <p className="text-sm text-red-300 font-medium">{error}</p>
              <Button onClick={() => fetchIssues()} variant="outline" className="border-slate-800 text-white">
                Retry Fetch
              </Button>
            </div>
          ) : issues.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center border-slate-800/80 space-y-4">
              <HelpCircle className="h-12 w-12 text-slate-600 mx-auto" />
              <div>
                <p className="text-white font-medium text-base">No Open Issues Found</p>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  We couldn&apos;t fetch open &apos;good first issue&apos; or &apos;help wanted&apos; issues for this repo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {issues.map((issue) => {
                const active = selectedIssue?.number === issue.number;
                return (
                  <button
                    key={issue.number}
                    onClick={() => setSelectedIssue(issue)}
                    className={`w-full glass p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 flex flex-col justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                      active
                        ? "border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/5"
                        : "border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/20"
                    }`}
                  >
                    <div className="space-y-1 w-full">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-purple-400 font-semibold font-mono">
                          #{issue.number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold border ${getScoreColor(
                            issue.score
                          )}`}
                        >
                          {issue.score}% Fit
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm sm:text-base text-white line-clamp-1 leading-snug text-left">
                        {issue.title}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed text-left w-full">
                      {issue.reason}
                    </p>

                    {/* Matched Files tag list */}
                    {issue.matchedFiles.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap w-full">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <Code2 className="h-3 w-3" />
                          Target File:
                        </span>
                        {issue.matchedFiles.map((file) => (
                          <span
                            key={file}
                            className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 text-[10px] text-slate-300 truncate max-w-[150px]"
                            title={file}
                          >
                            {file.split("/").pop()}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Map & Interactive details (70% split) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-heading font-semibold text-lg text-white">
              Interactive Blueprint Map
            </h3>
            {selectedIssue && (
              <a
                href={selectedIssue.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Open on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Visualizer Map */}
            <CodeDependencyGraph
              repository={repository}
              highlightedPaths={selectedIssue?.matchedFiles || []}
            />

            {/* Selected Issue Info Details panel */}
            {selectedIssue && (
              <Card className="glass border-slate-800">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 font-bold font-mono">
                          ISSUE #{selectedIssue.number}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <div className="flex gap-1.5">
                          {selectedIssue.labels.slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <h3 className="font-bold text-base sm:text-lg text-white">
                        {selectedIssue.title}
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border flex-shrink-0 ${getScoreColor(
                        selectedIssue.score
                      )}`}
                    >
                      {selectedIssue.score}% Match Score
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FolderDot className="h-4 w-4 text-purple-400" />
                      AI Codebase Match Recommendation
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-slate-800/40">
                      {selectedIssue.reason}
                    </p>
                  </div>

                  {selectedIssue.matchedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Files to modify (Highlighted in Map above)
                      </h4>
                      <div className="flex flex-col gap-1.5">
                        {selectedIssue.matchedFiles.map((file) => (
                          <div
                            key={file}
                            className="flex items-center gap-2 p-2 rounded bg-black/40 border border-slate-800/80 text-xs font-mono text-slate-200"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
