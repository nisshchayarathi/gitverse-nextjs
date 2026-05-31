import {
  isContentLengthTooLarge,
  isTextContentTooLarge,
  MAX_FILE_CONTENT_BYTES,
} from "@/lib/utils/fileContentLimits";

/** Helper: build a ReadableStream from a Uint8Array for streaming tests */
function makeStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Simulate the streaming guard used in the route */
async function streamGuard(stream: ReadableStream<Uint8Array>): Promise<"ok" | "too-large"> {
  const reader = stream.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FILE_CONTENT_BYTES) {
      await reader.cancel();
      return "too-large";
    }
  }
  return "ok";
}

describe("file content limits", () => {
  it("allows missing or in-range content-length headers", () => {
    expect(isContentLengthTooLarge(null)).toBe(false);
    expect(isContentLengthTooLarge(String(MAX_FILE_CONTENT_BYTES))).toBe(false);
  });

  it("rejects oversized content-length headers", () => {
    expect(isContentLengthTooLarge(String(MAX_FILE_CONTENT_BYTES + 1))).toBe(true);
  });

  it("rejects oversized text after download when no trustworthy length exists", () => {
    expect(isTextContentTooLarge("a".repeat(MAX_FILE_CONTENT_BYTES))).toBe(false);
    expect(isTextContentTooLarge("a".repeat(MAX_FILE_CONTENT_BYTES + 1))).toBe(true);
  });

  it("streaming guard: allows content within limit", async () => {
    const bytes = new Uint8Array(MAX_FILE_CONTENT_BYTES);
    expect(await streamGuard(makeStream(bytes))).toBe("ok");
  });

  it("streaming guard: rejects oversized streamed content without Content-Length", async () => {
    const bytes = new Uint8Array(MAX_FILE_CONTENT_BYTES + 1);
    expect(await streamGuard(makeStream(bytes))).toBe("too-large");
  });
});
