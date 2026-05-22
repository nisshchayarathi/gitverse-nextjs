export const validateRepoUrl = (url: string): boolean => {
  const githubRegex = /^https?:\/\/(www\.)?(github\.com)\/[\w-]+\/[\w.-]+/
  const gitlabRegex = /^https?:\/\/(www\.)?(gitlab\.com)\/[\w-]+\/[\w.-]+/
  const bitbucketRegex = /^https?:\/\/(www\.)?(bitbucket\.org)\/[\w-]+\/[\w.-]+/
  
  return githubRegex.test(url) || gitlabRegex.test(url) || bitbucketRegex.test(url)
}

export const extractRepoInfo = (url: string): { platform: string; owner: string; repo: string } | null => {
  const githubMatch = url.match(/github\.com\/([\w-]+)\/([\w.-]+)/)
  if (githubMatch) {
    return { platform: 'github', owner: githubMatch[1], repo: githubMatch[2] }
  }
  
  const gitlabMatch = url.match(/gitlab\.com\/([\w-]+)\/([\w.-]+)/)
  if (gitlabMatch) {
    return { platform: 'gitlab', owner: gitlabMatch[1], repo: gitlabMatch[2] }
  }
  
  const bitbucketMatch = url.match(/bitbucket\.org\/([\w-]+)\/([\w.-]+)/)
  if (bitbucketMatch) {
    return { platform: 'bitbucket', owner: bitbucketMatch[1], repo: bitbucketMatch[2] }
  }
  
  return null
}

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}
