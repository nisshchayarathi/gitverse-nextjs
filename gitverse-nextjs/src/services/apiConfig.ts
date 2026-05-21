/**
 * Get the API base URL
 * In development (localhost): uses http://localhost:3000 (Next.js API routes)
 * In production: uses the backend API domain (set via environment)
 */
export const getApiUrl = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const hostname = window.location.hostname;

  // In development (localhost), use Next.js API routes on same port
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return ""; // Empty string means same origin (Next.js API routes)
  }

  // In production, use environment variable or same origin
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (backendUrl) {
    return backendUrl.replace(/\/+$/, "");
  }

  // Default: use same origin (Next.js API routes)
  return "";
};

/**
 * Build full API endpoint URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiUrl();
  return `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
};
