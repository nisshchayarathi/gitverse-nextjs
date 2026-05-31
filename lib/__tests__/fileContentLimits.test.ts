import {
  isContentLengthTooLarge,
  isTextContentTooLarge,
  MAX_FILE_CONTENT_BYTES,
} from "@/lib/utils/fileContentLimits";

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
});
