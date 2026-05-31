export const MAX_FILE_CONTENT_BYTES = 1024 * 1024;

export function isContentLengthTooLarge(contentLength: string | null): boolean {
  if (!contentLength) {
    return false;
  }

  const parsedLength = Number(contentLength);
  return Number.isFinite(parsedLength) && parsedLength > MAX_FILE_CONTENT_BYTES;
}

export function isTextContentTooLarge(content: string): boolean {
  return Buffer.byteLength(content, "utf8") > MAX_FILE_CONTENT_BYTES;
}
