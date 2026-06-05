"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { buildApiUrl } from "@/services/apiConfig";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui";

type GitHubRepoApiItem = {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
};

type ConnectedRepo = {
  id: number;
  repoFullName: string;
  enabled: boolean;
  installationId: string | null;
};

type StoredPrReview = {
  id: number;
  createdAt: string;
  reviewText: string;
};

type StoredPullRequest = {
  id: number;
  prNumber: number;
  title: string;
  author: string;
  headSha: string;
  htmlUrl: string;
  status: string;
  updatedAt: string;
  reviews: StoredPrReview[];
};

type ReviewHistoryRepo = {
  id: number;
  repoFullName: string;
  enabled: boolean;
  installationId: string | null;
  pullRequests: StoredPullRequest[];
};

export default function Contribute() {
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    null | "install" | "delete" | "refreshRepos" | "syncRepos" | "saveSelection"
  >(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepoApiItem[]>([]);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<
    Set<string>
  >(new Set());
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);

  const [historyRepoFullName, setHistoryRepoFullName] = useState<string>("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRepos, setHistoryRepos] = useState<ReviewHistoryRepo[]>([]);

  const isGitHubAppInstalled = connectedRepos.some(
    (r) => r.installationId != null,
  );

  const isBusy = busyAction != null;

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("gitverse_token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchConnectedRepos = useCallback(async () => {
    try {
      const res = await axios.get(
        buildApiUrl("/api/integrations/github/connected-repos"),
        { headers: getAuthHeaders() },
      );

      const accountUsername = res.data?.account?.username as string | undefined;
      setGithubUsername(accountUsername || null);

      const dbRepos = Array.isArray(res.data?.repos) ? res.data.repos : [];
      const normalized: ConnectedRepo[] = dbRepos.map((r: any) => ({
        id: Number(r.id),
        repoFullName: String(r.repoFullName),
        enabled: Boolean(r.enabled),
        installationId:
          r.installationId != null ? String(r.installationId) : null,
      }));
      setConnectedRepos(normalized);

      const enabled = new Set<string>();
      for (const r of normalized) {
        if (r.enabled) enabled.add(r.repoFullName);
      }
      if (enabled.size > 0) setSelectedRepoFullNames(enabled);
    } catch {
      // best-effort
    }
  }, [getAuthHeaders]);

  const onLoadRepos = useCallback(async () => {
    setReposError(null);
    setBusyAction("refreshRepos");

    try {
      const res = await axios.post(
        buildApiUrl("/api/integrations/github/repositories"),
        {},
        { headers: getAuthHeaders() },
      );

      const items = Array.isArray(res.data?.repositories)
        ? res.data.repositories
        : [];
      setRepos(
        items.map((r: any) => ({
          id: Number(r.id),
          full_name: String(r.full_name),
          private: Boolean(r.private),
          html_url: String(r.html_url),
        })),
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to load repos";
      setReposError(message);
    } finally {
      setBusyAction(null);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchConnectedRepos();
    void onLoadRepos();

    // After GitHub App install redirect, re-fetch and then clean URL params.
    try {
      const url = new URL(window.location.href);
      const install = (url.searchParams.get("install") || "").trim();
      if (install === "ok") {
        // Small delay: allow DB writes from callback to settle.
        window.setTimeout(() => {
          void fetchConnectedRepos();
          void onLoadRepos();
        }, 250);

        // Remove install-related params so this runs only once.
        for (const key of [
          "install",
          "setup_action",
          "installation_id",
          "reason",
        ]) {
          url.searchParams.delete(key);
        }

        const nextQuery = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`;
        window.history.replaceState({}, "", nextUrl);
      }
    } catch {
      // ignore
    }
  }, [fetchConnectedRepos, onLoadRepos]);

  useEffect(() => {
    const enabledRepos = connectedRepos.filter((r) => r.enabled);
    const firstEnabled = enabledRepos[0]?.repoFullName;

    if (!historyRepoFullName) {
      if (firstEnabled) setHistoryRepoFullName(firstEnabled);
      return;
    }

    // If current selection is disabled (or removed), move to first enabled.
    const isStillEnabled = enabledRepos.some(
      (r) => r.repoFullName === historyRepoFullName,
    );
    if (!isStillEnabled) {
      setHistoryRepoFullName(firstEnabled || "");
    }
  }, [connectedRepos, historyRepoFullName]);

  const onLoadHistory = async () => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await axios.get(
        buildApiUrl(
          `/api/integrations/github/pr-reviews?repoFullName=${encodeURIComponent(
            historyRepoFullName,
          )}&limit=25`,
        ),
        { headers: getAuthHeaders() },
      );

      const repos = Array.isArray(res.data?.repos) ? res.data.repos : [];
      setHistoryRepos(repos as ReviewHistoryRepo[]);
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to load review history";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const onInstallGitHubApp = async () => {
    setReposError(null);
    setBusyAction("install");
    try {
      const res = await axios.post(
        buildApiUrl("/api/integrations/github/app/install-url"),
        {},
        { headers: getAuthHeaders() },
      );

      const url = res.data?.url as string | undefined;
      if (!url) {
        throw new Error("Install URL missing from response");
      }
      window.location.assign(url);
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to start GitHub App install";
      setReposError(message);
      setBusyAction(null);
    }
  };

  const onDeleteGitHubApp = async () => {
    setReposError(null);

    const ok = window.confirm(
      "Delete GitHub App data from GitVerse? This will remove all connected repos and stored PR reviews from the database.",
    );
    if (!ok) return;

    setBusyAction("delete");
    try {
      await axios.post(
        buildApiUrl("/api/integrations/github/app/delete"),
        {},
        { headers: getAuthHeaders() },
      );

      // Clear local UI state.
      setGithubUsername(null);
      setConnectedRepos([]);
      setSelectedRepoFullNames(new Set());
      setRepos([]);
      setHistoryRepoFullName("");
      setHistoryRepos([]);
      setHistoryError(null);
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to delete GitHub App data";
      setReposError(message);
    } finally {
      setBusyAction(null);
    }
  };

  const onSyncRepos = async () => {
    setReposError(null);

    if (!isGitHubAppInstalled) {
      setReposError("Install the GitHub App first, then sync.");
      return;
    }

    setBusyAction("syncRepos");
    try {
      await axios.post(
        buildApiUrl("/api/integrations/github/app/sync"),
        {},
        { headers: getAuthHeaders() },
      );

      // Refresh local state from DB-backed endpoints.
      await fetchConnectedRepos();
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to sync repos";
      setReposError(message);
    } finally {
      setBusyAction(null);
    }

    // Load latest repo list for the dropdown.
    void onLoadRepos();
  };

  const onSaveSelectedRepos = async () => {
    setReposError(null);

    if (selectedRepoFullNames.size === 0) {
      setReposError("Select at least one repository.");
      return;
    }

    setBusyAction("saveSelection");
    try {
      const res = await axios.post(
        buildApiUrl("/api/integrations/github/select-repos"),
        { repoFullNames: Array.from(selectedRepoFullNames) },
        { headers: getAuthHeaders() },
      );

      const dbRepos = Array.isArray(res.data?.repos) ? res.data.repos : [];
      setConnectedRepos(
        dbRepos.map((r: any) => ({
          id: Number(r.id),
          repoFullName: String(r.repoFullName),
          enabled: Boolean(r.enabled),
          installationId:
            r.installationId != null ? String(r.installationId) : null,
        })),
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.message ||
        "Failed to save selected repos";
      setReposError(message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="px-2 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-2">
            Contribute
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Connect GitHub, select repos, and run AI reviews.
          </p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Connect GitHub</CardTitle>
            <CardDescription>
              Install the GitHub App to enable automated PR reviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={
                  isGitHubAppInstalled ? onDeleteGitHubApp : onInstallGitHubApp
                }
                disabled={isBusy}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                {busyAction === "delete"
                  ? "Deleting…"
                  : busyAction === "install"
                    ? "Opening…"
                    : isGitHubAppInstalled
                      ? "Delete GitHub App"
                      : "Install GitHub App"}
              </Button>
              <Button variant="outline" onClick={onLoadRepos} disabled={isBusy}>
                {busyAction === "refreshRepos"
                  ? "Refreshing…"
                  : "Refresh Repos"}
              </Button>
              <Button
                variant="outline"
                onClick={onSyncRepos}
                disabled={isBusy || !isGitHubAppInstalled}
              >
                {busyAction === "syncRepos" ? "Syncing…" : "Sync Repos"}
              </Button>
            </div>

            {githubUsername && (
              <div className="text-sm text-muted-foreground">
                Connected as{" "}
                <span className="font-medium">{githubUsername}</span>
              </div>
            )}

            {reposError && (
              <div className="text-sm text-red-500 border border-red-500/30 bg-red-500/10 rounded-md p-3">
                {reposError}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading font-semibold">Select repos</h3>
                <Button
                  onClick={onSaveSelectedRepos}
                  disabled={isBusy || repos.length === 0}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  {busyAction === "saveSelection"
                    ? "Saving…"
                    : "Save Selection"}
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isBusy || repos.length === 0}
                  >
                    {repos.length === 0
                      ? "No repos loaded"
                      : selectedRepoFullNames.size > 0
                        ? `${selectedRepoFullNames.size} selected`
                        : "Choose repositories"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[360px] max-h-[360px] overflow-auto"
                >
                  <DropdownMenuCheckboxItem
                    checked={
                      repos.length > 0 &&
                      selectedRepoFullNames.size === repos.length
                    }
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => {
                      if (selectedRepoFullNames.size === repos.length) {
                        setSelectedRepoFullNames(new Set());
                        return;
                      }
                      setSelectedRepoFullNames(
                        new Set(repos.map((r) => r.full_name)),
                      );
                    }}
                  >
                    Select all
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    onSelect={(e) => e.preventDefault()}
                    checked={selectedRepoFullNames.size === 0}
                    onCheckedChange={() => setSelectedRepoFullNames(new Set())}
                  >
                    Clear selection
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {repos.map((r) => {
                    const checked = selectedRepoFullNames.has(r.full_name);
                    return (
                      <DropdownMenuCheckboxItem
                        key={r.id}
                        checked={checked}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={() => {
                          const next = new Set(selectedRepoFullNames);
                          if (checked) next.delete(r.full_name);
                          else next.add(r.full_name);
                          setSelectedRepoFullNames(next);
                        }}
                      >
                        <span className="truncate">{r.full_name}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {repos.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Install the GitHub App and then use{" "}
                  <span className="font-medium">Refresh Repos</span>.
                </div>
              ) : selectedRepoFullNames.size > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Automation will run only for selected repos.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Review History</CardTitle>
            <CardDescription>
              Shows stored webhook reviews (latest review per PR).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm text-muted-foreground">
                  Repository
                </label>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background/50 px-3 text-sm"
                  value={historyRepoFullName}
                  onChange={(e) => setHistoryRepoFullName(e.target.value)}
                >
                  {connectedRepos.filter((r) => r.enabled).length === 0 && (
                    <option value="">No enabled repos</option>
                  )}
                  {connectedRepos
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <option key={r.id} value={r.repoFullName}>
                        {r.repoFullName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={onLoadHistory}
                  disabled={historyLoading || !historyRepoFullName}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  {historyLoading ? "Loading…" : "Load"}
                </Button>
              </div>
            </div>

            {historyError && (
              <div className="text-sm text-red-500 border border-red-500/30 bg-red-500/10 rounded-md p-3">
                {historyError}
              </div>
            )}

            {historyRepos.length > 0 && (
              <div className="space-y-3">
                {historyRepos.map((repo) => (
                  <div key={repo.id} className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {repo.repoFullName}
                    </div>

                    {repo.pullRequests.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No stored PR reviews yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {repo.pullRequests.map((pr) => {
                          const latest = pr.reviews?.[0];
                          return (
                            <details
                              key={pr.id}
                              className="rounded-lg border border-border/50 bg-background/40 p-3"
                            >
                              <summary className="cursor-pointer select-none">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="font-medium">
                                    #{pr.prNumber} {pr.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {latest
                                      ? `Reviewed ${new Date(latest.createdAt).toLocaleString()}`
                                      : "No review stored"}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {pr.author} • {pr.status} •{" "}
                                  <a
                                    href={pr.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    Open on GitHub
                                  </a>
                                </div>
                              </summary>

                              {latest ? (
                                <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                                  {latest.reviewText}
                                </pre>
                              ) : (
                                <div className="mt-3 text-sm text-muted-foreground">
                                  Waiting for a webhook run to store the review.
                                </div>
                              )}
                            </details>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
