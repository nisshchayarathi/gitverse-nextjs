import { createSignedState, verifySignedState } from "../utils/signedState";

describe("lib/utils/signedState", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GITHUB_APP_STATE_SECRET = "supersecret123";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should create and verify a signed state successfully", () => {
    const payload = { userId: "123", action: "install" };
    const state = createSignedState(payload);

    expect(state).toContain(".");
    
    const result = verifySignedState<{ userId: string; action: string }>(state);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.userId).toBe("123");
      expect(result.payload.action).toBe("install");
    }
  });

  it("should fail validation if signature is tampered", () => {
    const payload = { userId: "123" };
    const state = createSignedState(payload);
    
    const [body] = state.split(".");
    const tamperedState = `${body}.tamperedsig`;

    const result = verifySignedState(tamperedState);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_signature");
    }
  });

  it("should fail validation if secret changes", () => {
    const payload = { userId: "123" };
    const state = createSignedState(payload);

    process.env.GITHUB_APP_STATE_SECRET = "differentsecret456";

    const result = verifySignedState(state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_signature");
    }
  });

  it("should fail validation if state string is malformed", () => {
    const result1 = verifySignedState("nosplitchar");
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.error).toBe("missing_state");
    }

    const result2 = verifySignedState(".");
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.error).toBe("bad_state");
    }
  });
});
