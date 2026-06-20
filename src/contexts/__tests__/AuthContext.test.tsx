import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

const mockSignOut = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signOut: jest.fn((opts) => mockSignOut(opts)),
}));

const { useSession } = require("next-auth/react");
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  describe("logout", () => {
    it("sends POST to logout endpoint with JWT token", async () => {
      localStorage.setItem("gitverse_token", "test-jwt-token");
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 1, name: "T", email: "t@t.com" } }) })
        .mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/logout"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-jwt-token",
          }),
        }),
      );
      expect(localStorage.getItem("gitverse_token")).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("calls signOut when NextAuth session exists", async () => {
      useSession.mockReturnValue({
        data: { user: { email: "test@test.com" } },
        status: "authenticated",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("clears user state after logout even on API failure", async () => {
      localStorage.setItem("gitverse_token", "test-jwt-token");
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 1, name: "T", email: "t@t.com" } }) })
        .mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(localStorage.getItem("gitverse_token")).toBe("test-jwt-token");
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("retries logout on failure", async () => {
      localStorage.setItem("gitverse_token", "test-jwt-token");
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 1, name: "T", email: "t@t.com" } }) })
        .mockRejectedValueOnce(new Error("Retry 1"))
        .mockRejectedValueOnce(new Error("Retry 2"))
        .mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout(2);
      });

      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 auth/me + 3 logout attempts
      expect(localStorage.getItem("gitverse_token")).toBeNull();
    });

    it("handles both JWT and NextAuth logout simultaneously", async () => {
      localStorage.setItem("gitverse_token", "test-jwt-token");
      const futureExpiry = new Date(Date.now() + 86400000).toISOString();
      useSession.mockReturnValue({
        data: { user: { email: "test@test.com" }, expires: futureExpiry },
        status: "authenticated",
      });
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/logout"),
        expect.anything(),
      );
      expect(mockSignOut).toHaveBeenCalled();
      expect(localStorage.getItem("gitverse_token")).toBeNull();
    });

    it("handles 401 response from logout endpoint gracefully", async () => {
      localStorage.setItem("gitverse_token", "expired-token");
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 1, name: "T", email: "t@t.com" } }) })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(localStorage.getItem("gitverse_token")).toBe("expired-token");
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("stores token and sets user on success", async () => {
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "new-jwt-token",
          user: { id: 1, name: "Test", email: "test@test.com" },
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });

      expect(localStorage.getItem("gitverse_token")).toBe("new-jwt-token");
      expect(result.current.user?.email).toBe("test@test.com");
    });

    it("passes rememberMe parameter to login endpoint", async () => {
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "new-jwt-token",
          user: { id: 1, name: "Test", email: "test@test.com" },
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@test.com", "password", true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/login"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@test.com",
            password: "password",
            rememberMe: true,
          }),
        })
      );
    });

    it("throws error on failed login", async () => {
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid credentials" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.login("test@test.com", "wrong");
        }),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("updateUser", () => {
    it("updates the user state", async () => {
      useSession.mockReturnValue({ data: null, status: "unauthenticated" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token",
          user: { id: 1, name: "Original", email: "test@test.com" },
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });

      act(() => {
        result.current.updateUser({ name: "Updated" });
      });

      expect(result.current.user?.name).toBe("Updated");
    });
  });

  describe("auth state from session", () => {
    it("sets user from NextAuth session", async () => {
      useSession.mockReturnValue({
        data: {
          user: { id: "1", name: "NextAuth User", email: "nextauth@test.com" },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe("nextauth@test.com");
    });

    it("sets loading false when session loading completes with no auth", async () => {
      useSession.mockReturnValue({ data: null, status: "loading" });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });
    });
  });
});
