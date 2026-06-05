/**
 * @jest-environment node
 */

import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { Readable } from "stream";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

jest.mock("child_process", () => {
  const actual = jest.requireActual("child_process");
  return { ...actual, spawn: jest.fn() };
});

jest.mock("@/lib/utils/repositoryUtils", () => ({
  normalizeKnownRepoHttpUrl: (url: string) => url,
}));

import { GitService } from "../gitService";

const mockSpawn = require("child_process").spawn as jest.Mock;

function makeMockChildProcess(): ChildProcess {
  const proc = new EventEmitter() as unknown as ChildProcess;
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  Object.defineProperty(proc, "stdout", { value: stdout, writable: true });
  Object.defineProperty(proc, "stderr", { value: stderr, writable: true });
  Object.defineProperty(proc, "stdin", { value: null, writable: true });
  Object.defineProperty(proc, "pid", { value: 12345, writable: true });
  Object.defineProperty(proc, "killed", { value: false, writable: true });
  Object.defineProperty(proc, "exitCode", { value: null, writable: true });
  Object.defineProperty(proc, "signalCode", { value: null, writable: true });
  (proc as any).kill = jest.fn();
  return proc;
}

let tmpDir: string;

beforeEach(async () => {
  mockSpawn.mockReset();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gv-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

describe("GitService abort signal handling", () => {
  describe("spawnOutput", () => {
    it("should resolve normally on successful process exit", async () => {
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const service = new GitService(tmpDir);
      const promise = (service as any).spawnGit(["status"]);

      await new Promise(r => setImmediate(r));

      (proc.stdout as Readable).push("output data");
      (proc.stdout as Readable).push(null);

      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);

      await expect(promise).resolves.toEqual({ stdout: "output data", stderr: "" });
    });

    it("should reject when abort signal fires during pending process", async () => {
      const controller = new AbortController();
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const service = new GitService(tmpDir, controller.signal);
      const promise = (service as any).spawnGit(["clone", "."]);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      controller.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow(/aborted/);
    });
  });

  describe("getCommits abort handling", () => {
    it("should reject when instance abort signal fires", async () => {
      const controller = new AbortController();
      const service = new GitService(tmpDir, controller.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      controller.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should reject when method-level abort signal fires", async () => {
      const service = new GitService(tmpDir);
      const methodController = new AbortController();
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100, methodController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      methodController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should resolve normally when git completes before abort", async () => {
      const controller = new AbortController();
      const service = new GitService(tmpDir, controller.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);

      await new Promise(r => setImmediate(r));

      const stdout = proc.stdout as Readable;
      stdout.push("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0|abc1234|Author|author@test.com|2024-01-01T00:00:00Z|Initial commit|||\n");
      stdout.push(null);

      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
    });

    it("should reject on git process error", async () => {
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      proc.emit("error", new Error("ENOENT"));
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow("Failed to get commits");
    });

    it("should reject when git exits non-zero with no commits parsed", async () => {
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);

      jest.useFakeTimers();
      proc.emit("exit", 128);
      (proc.stdout as Readable).push(null);
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow("Failed to get commits: git exited with code 128");
    });
  });

  describe("cloneRepository abort handling", () => {
    it("should reject when abort signal fires during clone", async () => {
      const controller = new AbortController();
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const cloneDir = path.join(tmpDir, "clone-abort");
      const promise = GitService.cloneRepository(
        "https://github.com/test/repo.git",
        cloneDir,
        { signal: controller.signal },
      );

      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      controller.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    }, 10000);

    it("should return GitService instance on successful clone", async () => {
      const controller = new AbortController();
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const cloneDir = path.join(tmpDir, "clone-success");
      const promise = GitService.cloneRepository(
        "https://github.com/test/repo.git",
        cloneDir,
        { signal: controller.signal },
      );

      // Yield multiple times for the async function to reach spawn
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setImmediate(r));
      }
      (proc.stderr as Readable).push(null);
      (proc.stdout as Readable).push(null);
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setImmediate(r));
      }
      proc.emit("close", 0);

      const result = await promise;
      expect(result).toBeInstanceOf(GitService);
    }, 10000);
  });

  describe("getBranches with signal", () => {
    it("should propagate method-level abort signal via spawnGit", async () => {
      const methodController = new AbortController();
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getBranches(methodController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      methodController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });
  });

  describe("getContributors with signal", () => {
    it("should propagate method-level abort signal via spawnGit", async () => {
      const methodController = new AbortController();
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getContributors(methodController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      methodController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });
  });

  describe("getFileTree with signal", () => {
    it("should propagate method-level abort signal via spawnGit", async () => {
      const methodController = new AbortController();
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getFileTree(undefined, methodController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      methodController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });
  });

  describe("detectLanguages with signal", () => {
    it("should forward abort signal to getFileTree", async () => {
      const service = new GitService(tmpDir);
      const controller = new AbortController();
      const fileTreeSpy = jest.spyOn(service, "getFileTree").mockResolvedValue([
        { path: "test.ts", name: "test.ts", size: 100, extension: ".ts", lines: 5, language: "TypeScript" },
      ]);

      const result = await service.detectLanguages(undefined, controller.signal);
      expect(fileTreeSpy).toHaveBeenCalledWith(undefined, controller.signal);
      expect(result).toHaveLength(1);
    });
  });

  describe("combined signal behavior", () => {
    it("should abort when method signal fires with both instance and method signals", async () => {
      const instanceController = new AbortController();
      const methodController = new AbortController();
      const service = new GitService(tmpDir, instanceController.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100, methodController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      methodController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should abort when instance signal fires without method signal", async () => {
      const instanceController = new AbortController();
      const service = new GitService(tmpDir, instanceController.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      instanceController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should abort when only instance signal fires (no method signal)", async () => {
      const instanceController = new AbortController();
      const service = new GitService(tmpDir, instanceController.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getBranches(instanceController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      instanceController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should abort getContributors via combined signal", async () => {
      const instanceController = new AbortController();
      const service = new GitService(tmpDir, instanceController.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getContributors(instanceController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      instanceController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });

    it("should abort getFileTree via combined signal", async () => {
      const instanceController = new AbortController();
      const service = new GitService(tmpDir, instanceController.signal);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getFileTree(undefined, instanceController.signal);

      await new Promise(r => setImmediate(r));
      jest.useFakeTimers();
      instanceController.abort();
      jest.advanceTimersByTime(6000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow();
    });
  });

  describe("no-signal edge cases", () => {
    it("should work when no signal is provided", async () => {
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100);
      (proc.stdout as Readable).push(null);
      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);
      proc.emit("exit", 0);

      const result = await promise;
      expect(result).toEqual([]);
    });

    it("should work correctly when undefined is passed as signal", async () => {
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getCommits("main", 100, undefined);
      (proc.stdout as Readable).push(null);
      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);
      proc.emit("exit", 0);

      const result = await promise;
      expect(result).toEqual([]);
    });

    it("should work correctly when signal is null-like", async () => {
      const service = new GitService(tmpDir);
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getContributors(undefined as any);
      await new Promise(r => setImmediate(r));
      (proc.stdout as Readable).push("author|email@test.com|2024-01-01T00:00:00Z\n1\t0\tindex.ts\n");
      (proc.stdout as Readable).push(null);
      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("author");
    });
  });

  describe("spawnOutput timeout", () => {
    it("should reject with timeout error when custom timeout fires", async () => {
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      jest.useFakeTimers();
      const service = new GitService(tmpDir);
      const promise = (service as any).spawnGit(["slow-command"], { timeout: 50 });

      jest.advanceTimersByTime(100);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow(/timed out/);
    });

    it("should reject with default timeout when no custom timeout given", async () => {
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      jest.useFakeTimers();
      const service = new GitService(tmpDir);
      const promise = (service as any).spawnGit(["slow-command"]);

      jest.advanceTimersByTime(130000);
      jest.useRealTimers();

      await expect(promise).rejects.toThrow(/timed out/);
    });

    it("should not fire timeout when process completes before timeout", async () => {
      const proc = makeMockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const service = new GitService(tmpDir);
      const promise = (service as any).spawnGit(["quick-command"], { timeout: 5000 });

      (proc.stdout as Readable).push("done");
      (proc.stdout as Readable).push(null);
      await new Promise(r => setImmediate(r));
      proc.emit("close", 0);

      await expect(promise).resolves.toEqual({ stdout: "done", stderr: "" });
    });
  });
});
