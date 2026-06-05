import { signOut } from "next-auth/react";

/**
 * A wrapper around fetch that automatically handles 401 Unauthorized responses
 * by clearing local tokens and redirecting the client to the login page.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      // Clear local JWT storage
      localStorage.removeItem("gitverse_token");

      // Redirect to login using next-auth signOut or directly via location
      const currentPath = window.location.pathname;
      const redirectUrl = `/login?from=${encodeURIComponent(currentPath)}`;
      
      // Trigger NextAuth signout and redirect
      signOut({ callbackUrl: redirectUrl });
    }
  }

  return response;
}
