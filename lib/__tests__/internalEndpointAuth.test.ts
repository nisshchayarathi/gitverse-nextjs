import {
  isBearerTokenAuthorized,
  isSecretHeaderAuthorized,
} from "@/lib/utils/internalEndpointAuth";

describe("internal endpoint authorization helpers", () => {
  it("authorizes matching internal secret headers", () => {
    expect(
      isSecretHeaderAuthorized({
        providedSecret: "runner-secret",
        configuredSecret: "runner-secret",
      })
    ).toBe(true);
  });

  it("rejects missing or mismatched internal secret headers", () => {
    expect(
      isSecretHeaderAuthorized({
        providedSecret: "runner-secret",
        configuredSecret: undefined,
      })
    ).toBe(false);

    expect(
      isSecretHeaderAuthorized({
        providedSecret: "runner-secret",
        configuredSecret: "different-secret",
      })
    ).toBe(false);
  });

  it("authorizes matching cron bearer tokens", () => {
    expect(
      isBearerTokenAuthorized({
        authorizationHeader: "Bearer cron-secret",
        configuredSecret: "cron-secret",
      })
    ).toBe(true);
  });

  it("rejects spoofable user-agent style inputs", () => {
    expect(
      isBearerTokenAuthorized({
        authorizationHeader: "vercel-cron/1.0",
        configuredSecret: "cron-secret",
      })
    ).toBe(false);
  });
});
