import {
  AUTH_TOKEN_KEY,
  REMEMBER_ME_KEY,
  getAuthToken,
  getRememberMePreference,
  initializeAuthSession,
  removeAuthToken,
  setAuthToken,
  setRememberMePreference,
} from "../authTokenStorage";

const SESSION_ACTIVE_KEY = "gitverse_session_active";

describe("authTokenStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("remember me preference", () => {
    it("defaults to false when unset", () => {
      expect(getRememberMePreference()).toBe(false);
    });

    it("persists remember me preference", () => {
      setRememberMePreference(true);
      expect(getRememberMePreference()).toBe(true);
      expect(localStorage.getItem(REMEMBER_ME_KEY)).toBe("true");
    });
  });

  describe("setAuthToken", () => {
    it("stores token and remember me preference", () => {
      setAuthToken("test-token", true);

      expect(getAuthToken()).toBe("test-token");
      expect(getRememberMePreference()).toBe(true);
      expect(sessionStorage.getItem(SESSION_ACTIVE_KEY)).toBe("1");
    });

    it("marks session-only logins as non-persistent", () => {
      setAuthToken("session-token", false);

      expect(getAuthToken()).toBe("session-token");
      expect(getRememberMePreference()).toBe(false);
    });
  });

  describe("initializeAuthSession", () => {
    it("clears token on new browser session when remember me is disabled", () => {
      localStorage.setItem(AUTH_TOKEN_KEY, "session-token");
      localStorage.setItem(REMEMBER_ME_KEY, "false");

      initializeAuthSession();

      expect(getAuthToken()).toBeNull();
      expect(sessionStorage.getItem(SESSION_ACTIVE_KEY)).toBe("1");
    });

    it("keeps token on new browser session when remember me is enabled", () => {
      localStorage.setItem(AUTH_TOKEN_KEY, "persistent-token");
      localStorage.setItem(REMEMBER_ME_KEY, "true");

      initializeAuthSession();

      expect(getAuthToken()).toBe("persistent-token");
    });

    it("does not clear token during the same browser session", () => {
      setAuthToken("active-token", false);
      sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");

      initializeAuthSession();

      expect(getAuthToken()).toBe("active-token");
    });
  });

  describe("removeAuthToken", () => {
    it("clears token and remember me preference", () => {
      setAuthToken("test-token", true);

      removeAuthToken();

      expect(getAuthToken()).toBeNull();
      expect(getRememberMePreference()).toBe(false);
    });
  });
});
