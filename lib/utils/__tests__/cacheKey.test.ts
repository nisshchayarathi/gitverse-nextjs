import { hashGeminiPromptSeed, buildCacheKey } from "../cacheKey";

describe("hashGeminiPromptSeed", () => {
  it("returns a consistent hash for the same input", () => {
    const a = hashGeminiPromptSeed({ foo: "bar", num: 42 });
    const b = hashGeminiPromptSeed({ foo: "bar", num: 42 });
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", () => {
    const a = hashGeminiPromptSeed({ foo: "bar" });
    const b = hashGeminiPromptSeed({ foo: "baz" });
    expect(a).not.toBe(b);
  });

  it("handles Date objects", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const result = hashGeminiPromptSeed({ timestamp: date });
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles nested objects with Date", () => {
    const input = {
      name: "test",
      dates: [new Date("2026-01-01T00:00:00Z"), new Date("2026-06-01T00:00:00Z")],
    };
    const result = hashGeminiPromptSeed(input);
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles Map objects", () => {
    const map = new Map<string, any>([
      ["key1", "value1"],
      ["key2", 42],
    ]);
    const result = hashGeminiPromptSeed({ data: map });
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles Set objects", () => {
    const set = new Set([1, 2, 3]);
    const result = hashGeminiPromptSeed({ tags: set });
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles BigInt values", () => {
    const result = hashGeminiPromptSeed({ big: BigInt("9007199254740991") });
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles null and undefined values", () => {
    const a = hashGeminiPromptSeed({ a: null, b: undefined });
    const b = hashGeminiPromptSeed({ a: null });
    expect(a).not.toBe(b);
  });

  it("produces stable output regardless of key order", () => {
    const a = hashGeminiPromptSeed({ z: 1, a: 2, m: 3 });
    const b = hashGeminiPromptSeed({ a: 2, z: 1, m: 3 });
    expect(a).toBe(b);
  });

  it("handles empty objects", () => {
    const result = hashGeminiPromptSeed({});
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("handles arrays with mixed types", () => {
    const result = hashGeminiPromptSeed({
      items: [1, "two", true, null, { nested: true }],
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
  });

  it("detects circular references without throwing", () => {
    const obj: any = { name: "circular" };
    obj.self = obj;
    const result = hashGeminiPromptSeed(obj);
    expect(typeof result).toBe("string");
  });
});

describe("buildCacheKey", () => {
  it("returns all required fields", () => {
    const key = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc123",
      analysisType: "overview",
    });

    expect(key.repositoryId).toBe(1);
    expect(key.commitHash).toBe("abc123");
    expect(key.analysisType).toBe("overview");
    expect(typeof key.promptHash).toBe("string");
    expect(key.modelVersion).toBe("unknown");
    expect(key.analysisScope).toBe("full");
  });

  it("uses provided modelVersion and analysisScope", () => {
    const key = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc123",
      analysisType: "overview",
      modelVersion: "gemini-2.5-pro",
      analysisScope: "src/",
    });

    expect(key.modelVersion).toBe("gemini-2.5-pro");
    expect(key.analysisScope).toBe("src/");
  });

  it("includes context in the hash computation", () => {
    const keyWithContext = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc123",
      analysisType: "overview",
      context: { fileTree: "src/" },
    });

    const keyWithout = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc123",
      analysisType: "overview",
    });

    expect(keyWithContext.promptHash).not.toBe(keyWithout.promptHash);
  });

  it("different modelVersion produces different promptHash", () => {
    const keyA = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc",
      analysisType: "overview",
      modelVersion: "gemini-2.5-flash",
    });

    const keyB = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc",
      analysisType: "overview",
      modelVersion: "gemini-2.5-pro",
    });

    expect(keyA.promptHash).not.toBe(keyB.promptHash);
  });

  it("different analysisScope produces different promptHash", () => {
    const keyA = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc",
      analysisType: "overview",
      analysisScope: "full",
    });

    const keyB = buildCacheKey({
      repositoryId: 1,
      commitHash: "abc",
      analysisType: "overview",
      analysisScope: "src/",
    });

    expect(keyA.promptHash).not.toBe(keyB.promptHash);
  });

  it("produces stable output for the same inputs", () => {
    const params = {
      repositoryId: 42,
      commitHash: "def456",
      analysisType: "security",
      modelVersion: "gemini-2.5-flash",
      analysisScope: "full",
      context: { languages: ["js", "ts"] },
    };

    const a = buildCacheKey(params);
    const b = buildCacheKey(params);
    expect(a.promptHash).toBe(b.promptHash);
  });
});
