import { renderHook, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { useRepositories } from "../useRepositories";

jest.mock("axios");

jest.mock("../../services/apiConfig", () => ({
  buildApiUrl: (path: string) => `http://localhost:3000${path}`,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildRepositoriesResponse(repos: any[] = [], nextCursor?: number, hasMore = false) {
  return {
    data: {
      data: {
        repositories: repos,
        nextCursor,
        hasMore,
      },
    },
  };
}

describe("src/hooks/useRepositories", () => {
  const originalGet = mockedAxios.get;

  beforeEach(() => {
    mockedAxios.get = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    mockedAxios.get = originalGet;
    jest.clearAllMocks();
  });

  it("fetches repositories on mount", async () => {
    mockedAxios.get.mockResolvedValueOnce(
      buildRepositoriesResponse([{ id: "1", name: "repo-a" }])
    );

    const { result } = renderHook(() => useRepositories());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toEqual([{ id: "1", name: "repo-a" }]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("sends the stored token in the Authorization header", async () => {
    localStorage.setItem("gitverse_token", "test-jwt-token");
    mockedAxios.get.mockResolvedValueOnce(buildRepositoriesResponse([]));

    renderHook(() => useRepositories());

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const [, config] = mockedAxios.get.mock.calls[0];
    expect(config.headers).toEqual({
      Authorization: "Bearer test-jwt-token",
    });
  });

  it("omits the Authorization header when no token is stored", async () => {
    mockedAxios.get.mockResolvedValueOnce(buildRepositoriesResponse([]));

    renderHook(() => useRepositories());

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const [, config] = mockedAxios.get.mock.calls[0];
    expect(config.headers).toBeUndefined();
  });

  it("surfaces an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValueOnce(
      new Error("Failed to fetch repositories.")
    );

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch repositories.");
    expect(result.current.repos).toEqual([]);
  });

  it("ignores aborted requests without setting an error", async () => {
    const abortError = new Error("canceled");
    abortError.name = "CanceledError";
    mockedAxios.get.mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it("appends new repos on loadMore without duplicating ids", async () => {
    mockedAxios.get.mockResolvedValueOnce(
      buildRepositoriesResponse([{ id: "1", name: "repo-a" }], 5, true)
    );
    mockedAxios.get.mockResolvedValueOnce(
      buildRepositoriesResponse([{ id: "1", name: "repo-a" }, { id: "2", name: "repo-b" }], undefined, false)
    );

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.repos).toEqual([
        { id: "1", name: "repo-a" },
        { id: "2", name: "repo-b" },
      ]);
    });
  });
});
