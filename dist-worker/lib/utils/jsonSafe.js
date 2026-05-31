"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJsonSafe = toJsonSafe;
function toJsonSafeInner(value, seen) {
    if (typeof value === "bigint")
        return value.toString();
    if (value == null)
        return value;
    if (value instanceof Date)
        return value;
    if (typeof value === "object") {
        if (seen.has(value))
            return null; // circular reference
        seen.add(value);
        let result;
        if (Array.isArray(value)) {
            result = value.map((v) => toJsonSafeInner(v, seen));
        }
        else {
            const obj = value;
            const out = {};
            for (const [key, v] of Object.entries(obj)) {
                out[key] = toJsonSafeInner(v, seen);
            }
            result = out;
        }
        // Remove after processing so shared (non-circular) references are not falsely flagged.
        seen.delete(value);
        return result;
    }
    return value;
}
/** Recursively converts a value to a JSON-safe representation; bigints become strings, circular references become null. */
function toJsonSafe(value) {
    return toJsonSafeInner(value, new WeakSet());
}
