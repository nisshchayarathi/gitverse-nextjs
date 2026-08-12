import { apiError } from "../api-error";

describe("lib/api-error", () => {
  describe("apiError", () => {
    it("returns a NextResponse JSON response", async () => {
      const response = apiError(400, "Bad request");
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
    });

    it("sets the provided HTTP status code", async () => {
      const response = apiError(404, "Repository not found");
      expect(response.status).toBe(404);
    });

    it("returns a correctly structured error payload", async () => {
      const response = apiError(401, "Invalid credentials");
      const body = await response.json();
      expect(body).toEqual({
        error: {
          message: "Invalid credentials",
        },
      });
    });

    it("includes the optional code inside the error payload", async () => {
      const response = apiError(429, "Rate limit exceeded", "RATE_LIMITED");
      const body = await response.json();
      expect(body).toEqual({
        error: {
          message: "Rate limit exceeded",
          code: "RATE_LIMITED",
        },
      });
    });

    it("omits the code key when not provided", async () => {
      const response = apiError(400, "Missing fields");
      const body = await response.json();
      expect(body.error).toEqual({ message: "Missing fields" });
      expect("code" in body.error).toBe(false);
    });

    it("supports the full range of common status codes", async () => {
      const statuses = [400, 401, 403, 404, 409, 422, 429, 500];
      for (const status of statuses) {
        const response = apiError(status, `Error ${status}`);
        expect(response.status).toBe(status);
      }
    });
  });
});
