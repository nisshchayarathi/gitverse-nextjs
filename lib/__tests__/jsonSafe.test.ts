import { toJsonSafe } from "../utils/jsonSafe";

describe("toJsonSafe – primitives", () => {
  it("passes through null and undefined", () => {
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe(undefined)).toBeUndefined();
  });

  it("passes through strings, numbers, and booleans", () => {
    expect(toJsonSafe("hello")).toBe("hello");
    expect(toJsonSafe(42)).toBe(42);
    expect(toJsonSafe(true)).toBe(true);
    expect(toJsonSafe(false)).toBe(false);
  });

  it("converts bigint to string", () => {
    expect(toJsonSafe(BigInt(42))).toBe("42");
    expect(toJsonSafe(BigInt("99999999999999999999"))).toBe(
      "99999999999999999999",
    );
  });

  it("preserves Date objects", () => {
    const d = new Date("2024-01-01");
    expect(toJsonSafe(d)).toBe(d);
  });
});

describe("toJsonSafe – arrays and objects", () => {
  it("passes through a plain array", () => {
    expect(toJsonSafe([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("converts bigints inside arrays", () => {
    expect(toJsonSafe([BigInt(1), BigInt(2)])).toEqual(["1", "2"]);
  });

  it("handles nested arrays", () => {
    expect(toJsonSafe([[1, BigInt(2)], [3]])).toEqual([[1, "2"], [3]]);
  });

  it("passes through a plain object", () => {
    expect(toJsonSafe({ a: 1, b: "two" })).toEqual({ a: 1, b: "two" });
  });

  it("converts bigints inside objects", () => {
    expect(toJsonSafe({ x: BigInt(10) })).toEqual({ x: "10" });
  });

  it("handles deeply nested objects", () => {
    expect(toJsonSafe({ a: { b: { c: BigInt(99) } } })).toEqual({
      a: { b: { c: "99" } },
    });
  });

  it("handles mixed arrays and objects", () => {
    expect(toJsonSafe({ arr: [BigInt(1), { n: BigInt(2) }] })).toEqual({
      arr: ["1", { n: "2" }],
    });
  });
});

describe("toJsonSafe – circular references", () => {
  it("replaces a direct self-reference with null", () => {
    const a: Record<string, unknown> = { name: "self" };
    a.self = a;
    const result = toJsonSafe(a) as Record<string, unknown>;
    expect(result.name).toBe("self");
    expect(result.self).toBeNull();
  });

  it("replaces mutual references with null on the back-edge", () => {
    const a: Record<string, unknown> = { label: "a" };
    const b: Record<string, unknown> = { label: "b" };
    a.other = b;
    b.other = a;
    const result = toJsonSafe(a) as Record<string, unknown>;
    const bResult = result.other as Record<string, unknown>;
    expect(result.label).toBe("a");
    expect(bResult.label).toBe("b");
    expect(bResult.other).toBeNull();
  });

  it("replaces a nested cycle with null", () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { parent: a };
    a.child = b;
    const result = toJsonSafe(a) as Record<string, unknown>;
    expect((result.child as Record<string, unknown>).parent).toBeNull();
  });

  it("replaces a circular array element with null", () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    const result = toJsonSafe(arr) as unknown[];
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBeNull();
  });
});

describe("toJsonSafe – shared (non-circular) references", () => {
  it("converts a shared object referenced from two sibling properties", () => {
    const shared = { value: BigInt(7) };
    const result = toJsonSafe({ a: shared, b: shared }) as {
      a: unknown;
      b: unknown;
    };
    expect(result.a).toEqual({ value: "7" });
    expect(result.b).toEqual({ value: "7" });
  });

  it("converts a shared array referenced from two sibling properties", () => {
    const shared = [BigInt(1), BigInt(2)];
    const result = toJsonSafe([shared, shared]) as unknown[][];
    expect(result[0]).toEqual(["1", "2"]);
    expect(result[1]).toEqual(["1", "2"]);
  });

  it("converts a shared nested object across multiple documents", () => {
    const meta = { created: new Date("2024-06-01"), version: 1 };
    const result = toJsonSafe({ a: { meta }, b: { meta } }) as Record<
      string,
      Record<string, unknown>
    >;
    expect(result.a.meta).not.toBeNull();
    expect((result.a.meta as Record<string, unknown>).version).toBe(1);
    expect((result.b.meta as Record<string, unknown>).version).toBe(1);
  });
});
