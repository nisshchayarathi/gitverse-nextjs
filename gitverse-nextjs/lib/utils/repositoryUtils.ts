/**
 * Language detection utilities
 */

export interface LanguageColors {
  [key: string]: string
}

export const LANGUAGE_COLORS: LanguageColors = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  HTML: '#e34c26',
  JSON: '#292929',
  Markdown: '#083fa1',
  YAML: '#cb171e',
}

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] || '#858585'
}

/**
 * File size formatting utilities
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Date formatting utilities
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`

  return `${Math.floor(diffInSeconds / 31536000)}y ago`
}

/**
 * Commit hash utilities
 */
export function getShortHash(hash: string, length: number = 7): string {
  return hash.substring(0, length)
}

/**
 * Avatar generation utilities
 */
export function generateAvatar(email: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
}

/**
 * Repository statistics calculation
 */
export interface RepositoryMetrics {
  totalLines: number
  codeQuality: number
  activityScore: number
  contributorDiversity: number
}

export function calculateRepositoryMetrics(data: {
  files: { size: number }[]
  commits: { committedAt: Date }[]
  contributors: { commits: number }[]
}): RepositoryMetrics {
  // Estimate total lines (rough approximation: 1 line = ~50 bytes)
  const totalLines = Math.floor(data.files.reduce((sum, f) => sum + Number(f.size), 0) / 50)

  // Calculate activity score based on recent commits
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentCommits = data.commits.filter((c) => c.committedAt >= thirtyDaysAgo).length
  const activityScore = Math.min(100, (recentCommits / 30) * 20) // Max 100 at 150 commits/month

  // Calculate contributor diversity (Shannon entropy)
  const totalCommits = data.contributors.reduce((sum, c) => sum + c.commits, 0)
  let entropy = 0
  for (const contributor of data.contributors) {
    const p = contributor.commits / totalCommits
    if (p > 0) {
      entropy -= p * Math.log2(p)
    }
  }
  const maxEntropy = Math.log2(data.contributors.length)
  const contributorDiversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0

  // Code quality score (placeholder - would need real linting/analysis)
  const codeQuality = 75 + Math.random() * 20 // Mock value between 75-95

  return {
    totalLines,
    codeQuality: Math.floor(codeQuality),
    activityScore: Math.floor(activityScore),
    contributorDiversity: Math.floor(contributorDiversity),
  }
}

/**
 * File tree building utilities
 */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileTreeNode[]
}

export function buildFileTree(
  files: { path: string; name: string; size: number }[]
): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const map = new Map<string, FileTreeNode>()

  // Sort files by path to process directories first
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sortedFiles) {
    const parts = file.path.split('/')
    let currentPath = ''
    let currentArray = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLastPart = i === parts.length - 1

      let node = map.get(currentPath)

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLastPart ? 'file' : 'directory',
          size: isLastPart ? file.size : undefined,
          children: isLastPart ? undefined : [],
        }

        map.set(currentPath, node)
        currentArray.push(node)
      }

      if (!isLastPart && node.children) {
        currentArray = node.children
      }
    }
  }

  return root
}

/**
 * Commit message parsing
 */
export interface ParsedCommit {
  type?: string
  scope?: string
  subject: string
  breaking: boolean
}

export function parseCommitMessage(message: string): ParsedCommit {
  // Parse conventional commit format: type(scope): subject
  const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/
  const match = message.match(conventionalPattern)

  if (match) {
    return {
      type: match[1],
      scope: match[2],
      subject: match[4],
      breaking: match[3] === '!',
    }
  }

  return {
    subject: message,
    breaking: message.toLowerCase().includes('breaking'),
  }
}

/**
 * Branch name utilities
 */
export function isFeatureBranch(branchName: string): boolean {
  return branchName.startsWith('feature/') || branchName.startsWith('feat/')
}

export function isBugfixBranch(branchName: string): boolean {
  return branchName.startsWith('bugfix/') || branchName.startsWith('fix/')
}

export function isReleaseBranch(branchName: string): boolean {
  return branchName.startsWith('release/') || branchName.startsWith('hotfix/')
}

/**
 * Code statistics
 */
export function calculateCodeChurn(
  commits: { additions: number; deletions: number; committedAt: Date }[]
): { date: string; churn: number }[] {
  const churnByDate = new Map<string, number>()

  for (const commit of commits) {
    const date = commit.committedAt.toISOString().split('T')[0]
    const churn = commit.additions + commit.deletions
    churnByDate.set(date, (churnByDate.get(date) || 0) + churn)
  }

  return Array.from(churnByDate.entries())
    .map(([date, churn]) => ({ date, churn }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
