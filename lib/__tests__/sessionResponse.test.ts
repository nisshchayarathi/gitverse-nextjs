import { SAFE_SESSION_SELECT } from "@/lib/utils/sessionResponse";

describe("SAFE_SESSION_SELECT", () => {
  it("only allows non-secret session metadata in API responses", () => {
    expect(SAFE_SESSION_SELECT).toEqual({
      id: true,
      expires: true,
      userId: true,
    });
    expect(SAFE_SESSION_SELECT).not.toHaveProperty("sessionToken");
  });
});
