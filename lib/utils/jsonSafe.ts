function toJsonSafeInner(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value == null) return value;
  if (value instanceof Date) return value;

  if (typeof value === "object") {
    if (seen.has(value as object)) return null; // circular reference
    seen.add(value as object);

    let result: unknown;

    if (Array.isArray(value)) {
      result = value.map((v) => toJsonSafeInner(v, seen));
    } else {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(obj)) {
        out[key] = toJsonSafeInner(v, seen);
      }
      result = out;
    }

    // Remove after processing so shared (non-circular) references are not falsely flagged.
    seen.delete(value as object);

    return result;
  }

  return value;
}

/** Recursively converts a value to a JSON-safe representation; bigints become strings, circular references become null. */
export function toJsonSafe(value: unknown): unknown {
  return toJsonSafeInner(value, new WeakSet());
}
