import crypto from "crypto";

type Scalar = string | number | boolean | null | undefined;

type StableValue =
  | Scalar
  | Date
  | StableValue[]
  | { [key: string]: StableValue }
  | Map<string, StableValue>
  | Set<StableValue>;

function seenMarker(): object {
  return {};
}

const SEEN = seenMarker();

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function stableStringify(
  value: unknown,
  seen?: Set<unknown>,
): string {
  if (seen === undefined) {
    seen = new Set<unknown>();
  }

  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "bigint") {
    return `"${value.toString()}n"`;
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof Map) {
    if (seen.has(value)) {
      return '"<circular>"';
    }
    seen.add(value);
    const entries: string[] = [];
    for (const [k, v] of value) {
      entries.push(`${JSON.stringify(k)}:${stableStringify(v, seen)}`);
    }
    entries.sort((a, b) => a.localeCompare(b));
    return `{${entries.join(",")}}`;
  }

  if (value instanceof Set) {
    if (seen.has(value)) {
      return '"<circular>"';
    }
    seen.add(value);
    const items: string[] = [];
    for (const item of value) {
      items.push(stableStringify(item, seen));
    }
    items.sort();
    return `[${items.join(",")}]`;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '"<circular>"';
    }
    seen.add(value);
    const items = value.map((item) => stableStringify(item, seen));
    return `[${items.join(",")}]`;
  }

  if (isObject(value)) {
    if (seen.has(value)) {
      return '"<circular>"';
    }
    seen.add(value);
    const keys = Object.keys(value).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key], seen)}`,
    );
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashGeminiPromptSeed(seed: unknown): string {
  const payload = stableStringify(seed);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export type CacheKeyParams = {
  repositoryId: number;
  commitHash: string;
  analysisType: string;
  modelVersion?: string;
  analysisScope?: string;
  context?: unknown;
};

export function buildCacheKey(params: CacheKeyParams): {
  repositoryId: number;
  commitHash: string;
  analysisType: string;
  promptHash: string;
  modelVersion: string;
  analysisScope: string;
} {
  const modelVersion = params.modelVersion || "unknown";
  const analysisScope = params.analysisScope || "full";

  const promptHash = hashGeminiPromptSeed({
    v: 2,
    repositoryId: params.repositoryId,
    commitHash: params.commitHash,
    analysisType: params.analysisType,
    modelVersion,
    analysisScope,
    context: params.context,
  });

  return {
    repositoryId: params.repositoryId,
    commitHash: params.commitHash,
    analysisType: params.analysisType,
    promptHash,
    modelVersion,
    analysisScope,
  };
}
