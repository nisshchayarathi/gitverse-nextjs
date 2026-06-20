/**
 * Triggers a browser download of a markdown file containing the specified content.
 * 
 * @param content The raw markdown string content
 * @param filename The desired name of the downloaded file (e.g. 'analysis.md')
 */
export function downloadMarkdown(content: string, filename: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.href = url;
  link.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
