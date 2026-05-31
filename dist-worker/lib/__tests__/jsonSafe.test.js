"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsonSafe_1 = require("../utils/jsonSafe");
describe("toJsonSafe – primitives", () => {
    it("passes through null and undefined", () => {
        expect((0, jsonSafe_1.toJsonSafe)(null)).toBeNull();
        expect((0, jsonSafe_1.toJsonSafe)(undefined)).toBeUndefined();
    });
    it("passes through strings, numbers, and booleans", () => {
        expect((0, jsonSafe_1.toJsonSafe)("hello")).toBe("hello");
        expect((0, jsonSafe_1.toJsonSafe)(42)).toBe(42);
        expect((0, jsonSafe_1.toJsonSafe)(true)).toBe(true);
        expect((0, jsonSafe_1.toJsonSafe)(false)).toBe(false);
    });
    it("converts bigint to string", () => {
        expect((0, jsonSafe_1.toJsonSafe)(BigInt(42))).toBe("42");
        expect((0, jsonSafe_1.toJsonSafe)(BigInt("99999999999999999999"))).toBe("99999999999999999999");
    });
    it("preserves Date objects", () => {
        const d = new Date("2024-01-01");
        expect((0, jsonSafe_1.toJsonSafe)(d)).toBe(d);
    });
});
describe("toJsonSafe – arrays and objects", () => {
    it("passes through a plain array", () => {
        expect((0, jsonSafe_1.toJsonSafe)([1, 2, 3])).toEqual([1, 2, 3]);
    });
    it("converts bigints inside arrays", () => {
        expect((0, jsonSafe_1.toJsonSafe)([BigInt(1), BigInt(2)])).toEqual(["1", "2"]);
    });
    it("handles nested arrays", () => {
        expect((0, jsonSafe_1.toJsonSafe)([[1, BigInt(2)], [3]])).toEqual([[1, "2"], [3]]);
    });
    it("passes through a plain object", () => {
        expect((0, jsonSafe_1.toJsonSafe)({ a: 1, b: "two" })).toEqual({ a: 1, b: "two" });
    });
    it("converts bigints inside objects", () => {
        expect((0, jsonSafe_1.toJsonSafe)({ x: BigInt(10) })).toEqual({ x: "10" });
    });
    it("handles deeply nested objects", () => {
        expect((0, jsonSafe_1.toJsonSafe)({ a: { b: { c: BigInt(99) } } })).toEqual({
            a: { b: { c: "99" } },
        });
    });
    it("handles mixed arrays and objects", () => {
        expect((0, jsonSafe_1.toJsonSafe)({ arr: [BigInt(1), { n: BigInt(2) }] })).toEqual({
            arr: ["1", { n: "2" }],
        });
    });
});
describe("toJsonSafe – circular references", () => {
    it("replaces a direct self-reference with null", () => {
        const a = { name: "self" };
        a.self = a;
        const result = (0, jsonSafe_1.toJsonSafe)(a);
        expect(result.name).toBe("self");
        expect(result.self).toBeNull();
    });
    it("replaces mutual references with null on the back-edge", () => {
        const a = { label: "a" };
        const b = { label: "b" };
        a.other = b;
        b.other = a;
        const result = (0, jsonSafe_1.toJsonSafe)(a);
        const bResult = result.other;
        expect(result.label).toBe("a");
        expect(bResult.label).toBe("b");
        expect(bResult.other).toBeNull();
    });
    it("replaces a nested cycle with null", () => {
        const a = {};
        const b = { parent: a };
        a.child = b;
        const result = (0, jsonSafe_1.toJsonSafe)(a);
        expect(result.child.parent).toBeNull();
    });
    it("replaces a circular array element with null", () => {
        const arr = [1, 2];
        arr.push(arr);
        const result = (0, jsonSafe_1.toJsonSafe)(arr);
        expect(result[0]).toBe(1);
        expect(result[1]).toBe(2);
        expect(result[2]).toBeNull();
    });
});
describe("toJsonSafe – shared (non-circular) references", () => {
    it("converts a shared object referenced from two sibling properties", () => {
        const shared = { value: BigInt(7) };
        const result = (0, jsonSafe_1.toJsonSafe)({ a: shared, b: shared });
        expect(result.a).toEqual({ value: "7" });
        expect(result.b).toEqual({ value: "7" });
    });
    it("converts a shared array referenced from two sibling properties", () => {
        const shared = [BigInt(1), BigInt(2)];
        const result = (0, jsonSafe_1.toJsonSafe)([shared, shared]);
        expect(result[0]).toEqual(["1", "2"]);
        expect(result[1]).toEqual(["1", "2"]);
    });
    it("converts a shared nested object across multiple documents", () => {
        const meta = { created: new Date("2024-06-01"), version: 1 };
        const result = (0, jsonSafe_1.toJsonSafe)({ a: { meta }, b: { meta } });
        expect(result.a.meta).not.toBeNull();
        expect(result.a.meta.version).toBe(1);
        expect(result.b.meta.version).toBe(1);
    });
});
