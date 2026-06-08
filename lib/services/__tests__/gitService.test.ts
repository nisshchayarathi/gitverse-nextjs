import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { GitService } from "../gitService";

describe("GitService", () => {
  describe("getRepositorySize", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitverse-repo-size-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("calculates repository size with portable filesystem APIs", async () => {
      await fs.writeFile(path.join(tempDir, "README.md"), "hello");

      const nestedDir = path.join(tempDir, "src");
      await fs.mkdir(nestedDir);
      await fs.writeFile(path.join(nestedDir, "index.ts"), "console.log('ok');");

      const readmeStat = await fs.stat(path.join(tempDir, "README.md"));
      const indexStat = await fs.stat(path.join(nestedDir, "index.ts"));
      const expectedSize = readmeStat.size + indexStat.size;

      const service = new GitService(tempDir);

      await expect(service.getRepositorySize()).resolves.toBe(expectedSize);
    });
  });
});
