export const AUTH_TOKEN_KEY = "gitverse_token";
export const REMEMBER_ME_KEY = "gitverse_remember_me";
const SESSION_ACTIVE_KEY = "gitverse_session_active";

export const TOKEN_EXPIRY_REMEMBER = "30d";
export const TOKEN_EXPIRY_SESSION = "24h";

export function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REMEMBER_ME_KEY) === "true";
}

export function setRememberMePreference(rememberMe: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
}

/**
 * Clears non-persistent tokens when a new browser session starts.
 * Tokens are kept in localStorage for compatibility, but removed on
 * restart unless "Remember me" was enabled at login.
 */
export function initializeAuthSession(): void {
  if (typeof window === "undefined") return;

  if (!sessionStorage.getItem(SESSION_ACTIVE_KEY)) {
    if (localStorage.getItem(REMEMBER_ME_KEY) !== "true") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string, rememberMe: boolean): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  setRememberMePreference(rememberMe);
  sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
}
