import fs from "fs/promises";
import path from "path";

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const TEST_DIR = path.join(process.cwd(), "public", "uploads", "avatars", "test-user");

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
});

const { storeAvatar, parseDataUrl } = require("../storageService");

describe("storeAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores a buffer to disk and returns a URL", async () => {
    const userId = 99999;
    const buffer = Buffer.from("test-image-data");
    const result = await storeAvatar(buffer, userId, "image/jpeg");

    expect(result.url).toMatch(new RegExp(`^/uploads/avatars/${userId}/\\d+_[a-z0-9]+\\.jpg$`));
    expect(result.filePath).toBeDefined();

    const fileContent = await fs.readFile(result.filePath);
    expect(fileContent.toString()).toBe("test-image-data");

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("creates the destination directory if it does not exist", async () => {
    const userId = 88888;
    const dir = path.join(process.cwd(), "public", "uploads", "avatars", String(userId));
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});

    const buffer = Buffer.from("new-dir-test");
    const result = await storeAvatar(buffer, userId, "image/png");

    const dirExists = await fs.stat(dir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);

    await fs.unlink(result.filePath).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns different filenames for sequential uploads", async () => {
    const userId = 77777;
    const buf1 = Buffer.from("image-a");
    const buf2 = Buffer.from("image-b");

    const r1 = await storeAvatar(buf1, userId, "image/jpeg");
    const r2 = await storeAvatar(buf2, userId, "image/jpeg");

    expect(r1.url).not.toBe(r2.url);

    await fs.unlink(r1.filePath).catch(() => {});
    await fs.unlink(r2.filePath).catch(() => {});
  });

  it("preserves file extension based on MIME type", async () => {
    const userId = 66666;
    const tests = [
      { mime: "image/jpeg", ext: "jpg" },
      { mime: "image/png", ext: "png" },
      { mime: "image/webp", ext: "webp" },
      { mime: "image/gif", ext: "gif" },
    ];

    for (const { mime, ext } of tests) {
      const result = await storeAvatar(Buffer.from("test"), userId, mime);
      expect(result.url).toMatch(new RegExp(`\\.${ext}$`));
      await fs.unlink(result.filePath).catch(() => {});
    }
  });

  it("defaults to jpg extension for unknown MIME types", async () => {
    const userId = 55555;
    const result = await storeAvatar(Buffer.from("test"), userId, "image/bmp");

    expect(result.url).toMatch(/\.jpg$/);

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("logs storage event with file size", async () => {
    const { logger } = require("@/lib/logger");
    const userId = 44444;
    const data = "x".repeat(1000);
    const result = await storeAvatar(Buffer.from(data), userId, "image/png");

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId, size: 1000 }),
      "Avatar stored on disk",
    );

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("writes correct binary content", async () => {
    const userId = 33333;
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await storeAvatar(binaryContent, userId, "image/png");

    const written = await fs.readFile(result.filePath);
    expect(Buffer.from(written)).toEqual(binaryContent);

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("handles empty buffer", async () => {
    const userId = 22222;
    const result = await storeAvatar(Buffer.alloc(0), userId, "image/jpeg");

    const written = await fs.readFile(result.filePath);
    expect(written.length).toBe(0);

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("handles large buffer near size limit", async () => {
    const userId = 11111;
    const largeBuf = Buffer.alloc(500 * 1024);
    const result = await storeAvatar(largeBuf, userId, "image/jpeg");

    const written = await fs.readFile(result.filePath);
    expect(written.length).toBe(500 * 1024);

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("stores different users in separate directories", async () => {
    const userA = 111;
    const userB = 222;
    const buf = Buffer.from("data");

    const rA = await storeAvatar(buf, userA, "image/png");
    const rB = await storeAvatar(buf, userB, "image/png");

    expect(rA.url).toContain(`/uploads/avatars/${userA}/`);
    expect(rB.url).toContain(`/uploads/avatars/${userB}/`);
    expect(path.dirname(rA.filePath)).not.toBe(path.dirname(rB.filePath));

    await fs.unlink(rA.filePath).catch(() => {});
    await fs.unlink(rB.filePath).catch(() => {});
  });

  it("returns an absolute filePath", async () => {
    const userId = 1001;
    const result = await storeAvatar(Buffer.from("x"), userId, "image/jpeg");

    expect(result.filePath).toBeDefined();
    expect(result.filePath.replace(/\\/g, "/")).toContain("public/uploads/avatars");

    await fs.unlink(result.filePath).catch(() => {});
  });

  it("url starts with /uploads/avatars/", async () => {
    const result = await storeAvatar(Buffer.from("x"), 1002, "image/jpeg");
    expect(result.url).toMatch(/^\/uploads\/avatars\//);
    await fs.unlink(result.filePath).catch(() => {});
  });

  it("generates unique filenames with timestamp and random suffix", async () => {
    const result = await storeAvatar(Buffer.from("x"), 1003, "image/jpeg");
    const filename = path.basename(result.url);
    expect(filename).toMatch(/^\d+_[a-z0-9]{6}\.jpg$/);
    await fs.unlink(result.filePath).catch(() => {});
  });
});

describe("parseDataUrl", () => {
  it("parses a valid JPEG data URL", () => {
    const result = parseDataUrl("data:image/jpeg;base64,/9j/4AAQ");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/jpeg");
    expect(Buffer.isBuffer(result!.buffer)).toBe(true);
  });

  it("parses a valid PNG data URL", () => {
    const result = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/png");
  });

  it("parses a valid WebP data URL", () => {
    const result = parseDataUrl("data:image/webp;base64,UklGRhoA");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/webp");
  });

  it("decodes base64 content correctly", () => {
    const original = "hello-world";
    const encoded = Buffer.from(original).toString("base64");
    const result = parseDataUrl(`data:text/plain;base64,${encoded}`);
    expect(result!.buffer.toString()).toBe(original);
  });

  it("returns null for non-data URLs", () => {
    expect(parseDataUrl("https://example.com/image.jpg")).toBeNull();
  });

  it("returns null for data URLs without base64", () => {
    expect(parseDataUrl("data:image/jpeg,raw-data")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDataUrl("")).toBeNull();
  });

  it("returns null for strings without comma separator", () => {
    expect(parseDataUrl("data:image/jpeg;base64")).toBeNull();
  });

  it("extracts correct mimeType with charset parameter", () => {
    const result = parseDataUrl("data:image/png;charset=utf-8;base64,abc");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/png");
  });

  it("handles base64 with padding characters", () => {
    const result = parseDataUrl("data:image/png;base64,YWJj");
    expect(result).not.toBeNull();
    expect(result!.buffer.toString()).toBe("abc");
  });

  it("handles base64 without padding", () => {
    const result = parseDataUrl("data:image/png;base64,YWJjZGU=");
    expect(result).not.toBeNull();
    expect(result!.buffer.toString()).toBe("abcde");
  });

  it("returns GIF mime type correctly", () => {
    const result = parseDataUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAAA");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/gif");
  });
});
