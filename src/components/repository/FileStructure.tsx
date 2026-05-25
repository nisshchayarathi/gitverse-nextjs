import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  X,
  GitCommit,
  BarChart3,
  Code,
  Clock,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui";
import { buildApiUrl } from "@/services/apiConfig";

interface FileData {
  name: string;
  path: string;
  size?: number;
  extension?: string;
  language?: string;
  lines?: number;
  createdAt?: string;
}

interface FileStats {
  path: string;
  commitCount: number;
  additions: number;
  deletions: number;
}

interface RepositoryData {
  id?: number;
  name?: string;
  files?: FileData[];
}

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  size?: number;
  fileData?: FileData; // Reference to the actual file object from repository
  children?: FileNode[];
}

interface FileTreeProps {
  node: FileNode;
  level?: number;
  onFileSelect?: (fileData: FileData) => void;
}

const FileTreeNode: React.FC<FileTreeProps> = ({
  node,
  level = 0,
  onFileSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);

  const handleToggle = () => {
    if (node.type === "folder") {
      setIsExpanded(!isExpanded);
    } else if (node.fileData) {
      onFileSelect?.(node.fileData);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    const iconClass = "h-4 w-4";

    switch (ext) {
      case "ts":
      case "tsx":
        return <File className={`${iconClass} text-blue-500`} />;
      case "js":
      case "jsx":
        return <File className={`${iconClass} text-yellow-500`} />;
      case "css":
      case "scss":
        return <File className={`${iconClass} text-purple-500`} />;
      case "json":
        return <File className={`${iconClass} text-green-500`} />;
      case "md":
        return <File className={`${iconClass} text-gray-500`} />;
      default:
        return <File className={`${iconClass} text-muted-foreground`} />;
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-accent/50 transition-colors`}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        onClick={handleToggle}
      >
        {node.type === "folder" && (
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
        {node.type === "folder" ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <Folder className="h-4 w-4 text-primary" />
          )
        ) : (
          getFileIcon(node.name)
        )}
        <span className="text-sm flex-1">{node.name}</span>
        {node.type === "file" && node.size && (
          <span className="text-xs text-muted-foreground">
            {formatBytes(node.size)}
          </span>
        )}
      </div>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNode
              key={index}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
};

interface FileStructureProps {
  repository?: RepositoryData;
}

export const FileStructure = ({ repository }: FileStructureProps) => {
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [fileStatsByPath, setFileStatsByPath] = useState<
    Record<string, FileStats>
  >({});
  const [fileStatsLoading, setFileStatsLoading] = useState(false);

  // Build file tree from repository files
  const buildFileTree = (files: FileData[]): FileNode => {
    const root: FileNode = {
      name: repository?.name || "root",
      type: "folder",
      path: "/",
      children: [],
    };

    files?.forEach((file: FileData) => {
      const parts = file.path.split("/").filter(Boolean);
      let current = root;

      parts.forEach((part: string, index: number) => {
        const isLast = index === parts.length - 1;
        const path = "/" + parts.slice(0, index + 1).join("/");

        if (!current.children) current.children = [];

        let existing = current.children.find((c) => c.name === part);
        if (!existing) {
          existing = {
            name: part,
            type: isLast ? "file" : "folder",
            path,
            size: isLast ? file.size : undefined,
            fileData: isLast ? file : undefined, // Store the actual file object for files
            children: isLast ? undefined : [],
          };
          current.children.push(existing);
        }

        if (!isLast) current = existing;
      });
    });

    return root;
  };

  const files = useMemo(() => repository?.files || [], [repository?.files]);
  const fileTree = useMemo(() => buildFileTree(files), [files, repository?.name]);

  useEffect(() => {
    if (!repository?.id || files.length === 0) {
      setFileStatsByPath({});
      setFileStatsLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchFileStats = async () => {
      setFileStatsLoading(true);

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("gitverse_token")
            : null;
        const response = await fetch(
          buildApiUrl(`/api/repositories/${repository.id}/files/stats`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ paths: files.map((file) => file.path) }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load file statistics");
        }

        const data = await response.json();
        const nextStats = (data.stats || []).reduce(
          (acc: Record<string, FileStats>, stat: FileStats) => {
            acc[stat.path] = stat;
            return acc;
          },
          {}
        );

        setFileStatsByPath(nextStats);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching file statistics:", error);
          setFileStatsByPath({});
        }
      } finally {
        if (!controller.signal.aborted) {
          setFileStatsLoading(false);
        }
      }
    };

    fetchFileStats();

    return () => controller.abort();
  }, [files, repository?.id]);

  const handleFileSelect = (fileData: FileData) => {
    setSelectedFile(fileData);
  };

  const getFileStats = (filePath: string): FileStats => {
    return (
      fileStatsByPath[filePath] || {
        path: filePath,
        commitCount: 0,
        additions: 0,
        deletions: 0,
      }
    );
  };

  const selectedFileStats = selectedFile
    ? getFileStats(selectedFile.path)
    : null;
  const selectedFileTotalChanges = selectedFileStats
    ? selectedFileStats.additions + selectedFileStats.deletions
    : 0;
  const selectedFileNetChange = selectedFileStats
    ? selectedFileStats.additions - selectedFileStats.deletions
    : 0;

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-heading">File Structure</CardTitle>
          <CardDescription>
            Explore the repository&apos;s file system
          </CardDescription>
          <CardDescription>*Click on a file for more info*</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-lg p-4 bg-background/50 max-h-[600px] overflow-y-auto">
            <FileTreeNode node={fileTree} onFileSelect={handleFileSelect} />
          </div>
        </CardContent>
      </Card>

      {/* File Analytics Modal */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedFile(null)}
        >
          <Card
            className="glass max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 animate-fade-in-up"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            {/* File Header */}
            <div className="mb-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold break-all">
                    {selectedFile.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 font-mono break-all">
                    {selectedFile.path}
                  </p>
                </div>
              </div>

              {/* File Type and Extension */}
              {selectedFile.extension && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                    {selectedFile.extension.toUpperCase()}
                  </span>
                  {selectedFile.language && (
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                      {selectedFile.language}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                  <Code className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">
                    Lines of Code
                  </span>
                </div>
                <p className="text-3xl font-bold">
                  {selectedFile.lines?.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-green-400">
                  <GitCommit className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">
                    Commits
                  </span>
                </div>
                <p className="text-3xl font-bold">
                  {fileStatsLoading
                    ? "..."
                    : selectedFileStats?.commitCount.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-yellow-400">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">
                    File Size
                  </span>
                </div>
                <p className="text-3xl font-bold">
                  {formatBytes(selectedFile.size || 0)}
                </p>
              </div>
            </div>

            {/* Code Changes Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Changes History */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GitCommit className="h-5 w-5 text-primary" />
                  Code Changes
                </h3>

                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">
                        Lines Added
                      </p>
                      <p className="text-2xl font-bold text-green-400">
                        +
                        {fileStatsLoading
                          ? "..."
                          : selectedFileStats?.additions.toLocaleString() || 0}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total additions across all commits
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">
                        Lines Deleted
                      </p>
                      <p className="text-2xl font-bold text-red-400">
                        -
                        {fileStatsLoading
                          ? "..."
                          : selectedFileStats?.deletions.toLocaleString() || 0}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total deletions across all commits
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide">
                        Net Change
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          selectedFileNetChange >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {fileStatsLoading
                          ? "..."
                          : `${selectedFileNetChange >= 0 ? "+" : ""}${selectedFileNetChange.toLocaleString()}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Net additions minus deletions
                    </p>
                  </div>
                </div>
              </div>

              {/* File Metrics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  File Metrics
                </h3>

                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
                      Changes per Commit
                    </p>
                    <p className="text-2xl font-bold">
                      {!fileStatsLoading && selectedFileStats?.commitCount
                        ? Math.round(
                            selectedFileTotalChanges /
                              selectedFileStats.commitCount
                          )
                        : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Average lines changed per commit
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
                      Churn Ratio
                    </p>
                    <p className="text-2xl font-bold">
                      {!fileStatsLoading && selectedFileTotalChanges > 0
                        ? (
                            ((selectedFileStats?.deletions || 0) /
                              selectedFileTotalChanges) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Percentage of deletions vs additions
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
                      Created Date
                    </p>
                    <p className="text-sm font-semibold">
                      {selectedFile.createdAt
                        ? new Date(selectedFile.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      First added to repository
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Summary */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground uppercase text-xs tracking-wide mb-1">
                    Total Modifications
                  </p>
                  <p className="text-lg font-semibold">
                    {fileStatsLoading
                      ? "..."
                      : selectedFileStats?.commitCount.toLocaleString() || 0}{" "}
                    {selectedFileStats?.commitCount === 1
                      ? "commit"
                      : "commits"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase text-xs tracking-wide mb-1">
                    Impact
                  </p>
                  <p className="text-lg font-semibold">
                    {fileStatsLoading
                      ? "..."
                      : selectedFileTotalChanges.toLocaleString()}{" "}
                    changes
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase text-xs tracking-wide mb-1">
                    Current Size
                  </p>
                  <p className="text-lg font-semibold">
                    {selectedFile.lines?.toLocaleString() || 0} lines
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
