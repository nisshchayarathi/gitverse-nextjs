import { ValidationRunnerService } from "../validation-runner";

describe("ValidationRunnerService", () => {
  let service: ValidationRunnerService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ValidationRunnerService();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("runValidation", () => {
    it("should successfully execute simulated validation", async () => {
      const repoPath = "/path/to/mock-repo";
      const result = await service.runValidation(repoPath, true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[ValidationRunner] Simulating test execution in ${repoPath}...`)
      );

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.testOutput).toContain("PASS src/index.test.ts");
      expect(result.testOutput).toContain("Tests: 42 passed, 42 total");
      expect(result.buildOutput).toContain("tsc --noEmit");
      expect(result.lintOutput).toContain("npm run lint");
    });

    it("should work correctly when refactored is false", async () => {
      const repoPath = "/path/to/mock-repo";
      const result = await service.runValidation(repoPath, false);

      expect(result.passed).toBe(true);
    });
  });
});
