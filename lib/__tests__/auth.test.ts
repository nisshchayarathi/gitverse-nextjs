describe("lib/auth", () => {
  const originalEnv = process.env;
  const jwt = require("jsonwebtoken");

  function loadAuth() {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret",
    };

    return require("../auth") as typeof import("../auth");
  }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret",
    };
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it("returns a payload for a valid token", () => {
    const { generateToken, verifyToken } = loadAuth();

    const token = generateToken({
      userId: 42,
      email: "test@example.com",
    });

    const result = verifyToken(token);

    expect(result).toHaveProperty("payload");
    if ("payload" in result) {
      expect(result.payload.userId).toBe(42);
      expect(result.payload.email).toBe("test@example.com");
    }
  });

  it("marks an expired token as expired", () => {
    const { verifyToken } = loadAuth();

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-31T00:00:00.000Z"));

    const token = jwt.sign(
      { userId: 42, email: "test@example.com" },
      "test-secret",
      { expiresIn: "1s" }
    );

    jest.setSystemTime(new Date("2026-05-31T00:00:02.000Z"));

    expect(verifyToken(token)).toEqual({ error: "expired" });
  });

  it("marks a malformed token as invalid", () => {
    const { verifyToken } = loadAuth();

    expect(verifyToken("not-a-jwt")).toEqual({ error: "invalid" });
  });

  it("marks a token signed with the wrong secret as invalid", () => {
    const { verifyToken } = loadAuth();

    const token = jwt.sign(
      { userId: 42, email: "test@example.com" },
      "another-secret"
    );

    expect(verifyToken(token)).toEqual({ error: "invalid" });
  });

  it("marks a not-before token as invalid", () => {
    const { verifyToken } = loadAuth();

    const token = jwt.sign(
      { userId: 42, email: "test@example.com" },
      "test-secret",
      { notBefore: "10s" }
    );

    expect(verifyToken(token)).toEqual({ error: "invalid" });
  });
});