import { PatchValidatorService } from "../patch-validator";

const service = new PatchValidatorService();

function makePatch(overrides: Record<string, unknown> = {}) {
  return {
    file: "test.ts",
    suggestionBody: "const x = 1;",
    startLine: 1,
    endLine: 1,
    confidenceScore: 90,
    status: "pending" as const,
    ...overrides,
  };
}

describe("PatchValidatorService", () => {
  describe("validatePatch", () => {
    it("should return valid status for a correct patch", () => {
      const result = service.validatePatch(makePatch(), "const a = 0;");
      expect(result.status).toBe("valid");
    });

    it("should return low_confidence when score is below threshold", () => {
      const result = service.validatePatch(
        makePatch({ confidenceScore: 50 }),
        "const a = 0;"
      );
      expect(result.status).toBe("low_confidence");
    });

    it("should return invalid_syntax for patched content with syntax errors", () => {
      const result = service.validatePatch(
        makePatch({ suggestionBody: "const x =" }),
        "const a = 0;"
      );
      expect(result.status).toBe("invalid_syntax");
    });

    it("should skip TS syntax check for non-TS/JS files", () => {
      const result = service.validatePatch(
        makePatch({ file: "readme.md", suggestionBody: "# Broken ```" }),
        "# Title"
      );
      expect(result.status).toBe("valid");
    });

    it("should handle patches with startLine different from endLine", () => {
      const original = "line1\nline2\nline3\nline4\nline5";
      const result = service.validatePatch(
        makePatch({
          startLine: 2,
          endLine: 4,
          suggestionBody: "replacement",
        }),
        original
      );
      expect(result.status).toBe("valid");
    });

    it("should handle empty suggestionBody gracefully", () => {
      const result = service.validatePatch(
        makePatch({ suggestionBody: "" }),
        "const a = 0;"
      );
      expect(result.status).not.toBe("invalid_syntax");
    });

    it("should handle .tsx files", () => {
      const result = service.validatePatch(
        makePatch({ file: "component.tsx", suggestionBody: "const x: number = 1;" }),
        "const a = 0;"
      );
      expect(result.status).toBe("valid");
    });

    it("should handle .js files", () => {
      const result = service.validatePatch(
        makePatch({ file: "script.js", suggestionBody: "const x = 1;" }),
        ""
      );
      expect(result.status).toBe("valid");
    });
  });
});
