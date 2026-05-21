export function toJsonSafe(value: unknown): any {
  if (typeof value === "bigint") return value.toString();
  if (value == null) return value;

  // Preserve Date objects; JSON.stringify will call toJSON() => ISO string.
  if (value instanceof Date) return value;

  if (Array.isArray(value)) return value.map((v) => toJsonSafe(v));

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      out[key] = toJsonSafe(v);
    }
    return out;
  }

  return value;
}
