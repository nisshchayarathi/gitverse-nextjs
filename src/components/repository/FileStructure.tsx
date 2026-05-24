import { useState } from "react";
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

interface FileData {
  name: string;
  path: string;
  size?: number;
  extension?: string;
  language?: string;
  lines?: number;
  createdAt?: string;
}

interface FileChange {
  path: string;
  additions?: number;
  deletions?: number;
  type?: "added" | "modified" | "deleted";
}

interface CommitData {
  fileChanges?: FileChange[];
}

interface RepositoryData {
  name?: string;
  files?: FileData[];
  commits?: CommitData[];
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

  const fileTree = buildFileTree(repository?.files || []);

  const handleFileSelect = (fileData: FileData) => {
    setSelectedFile(fileData);
  };

  // Count commits for a specific file
  const getFileCommitCount = (filePath: string): number => {
    return (
      repository?.commits?.reduce((count: number, commit: CommitData) => {
        const fileChanged = commit.fileChanges?.some(
          (fc: FileChange) => fc.path === filePath
        );
        return fileChanged ? count + 1 : count;
      }, 0) || 0
    );
  };

  // Get file changes stats
  const getFileChangeStats = (filePath: string) => {
    let additions = 0;
    let deletions = 0;
    repository?.commits?.forEach((commit: CommitData) => {
      commit.fileChanges?.forEach((change: FileChange) => {
        if (change.path === filePath) {
          additions += change.additions || 0;
          deletions += change.deletions || 0;
        }
      });
    });
    return { additions, deletions };
  };

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
                  {getFileCommitCount(selectedFile.path)}
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
                        {getFileChangeStats(
                          selectedFile.path
                        ).additions.toLocaleString()}
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
                        {getFileChangeStats(
                          selectedFile.path
                        ).deletions.toLocaleString()}
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
                        className={`text-2xl font-bold ${getFileChangeStats(selectedFile.path).additions - getFileChangeStats(selectedFile.path).deletions >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {getFileChangeStats(selectedFile.path).additions -
                          getFileChangeStats(selectedFile.path).deletions >=
                        0
                          ? "+"
                          : ""}
                        {(
                          getFileChangeStats(selectedFile.path).additions -
                          getFileChangeStats(selectedFile.path).deletions
                        ).toLocaleString()}
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
                      {getFileCommitCount(selectedFile.path) > 0
                        ? Math.round(
                            (getFileChangeStats(selectedFile.path).additions +
                              getFileChangeStats(selectedFile.path).deletions) /
                              getFileCommitCount(selectedFile.path)
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
                      {getFileChangeStats(selectedFile.path).additions +
                        getFileChangeStats(selectedFile.path).deletions >
                      0
                        ? (
                            (getFileChangeStats(selectedFile.path).deletions /
                              (getFileChangeStats(selectedFile.path).additions +
                                getFileChangeStats(selectedFile.path)
                                  .deletions)) *
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
                    {getFileCommitCount(selectedFile.path)}{" "}
                    {getFileCommitCount(selectedFile.path) === 1
                      ? "commit"
                      : "commits"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase text-xs tracking-wide mb-1">
                    Impact
                  </p>
                  <p className="text-lg font-semibold">
                    {(
                      getFileChangeStats(selectedFile.path).additions +
                      getFileChangeStats(selectedFile.path).deletions
                    ).toLocaleString()}{" "}
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
