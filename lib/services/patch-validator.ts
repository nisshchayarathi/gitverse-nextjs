import { SelfHealingPatch, SELF_HEAL_CONFIDENCE_THRESHOLD } from "../../types/self-healing";
import * as ts from "typescript";

export class PatchValidatorService {
  /**
   * Validates if the patch is safe to apply.
   * Checks confidence score and ensures the new code doesn't introduce syntax errors.
   */
  validatePatch(
    patch: Partial<SelfHealingPatch>,
    originalContent: string
  ): SelfHealingPatch {
    const fullPatch = patch as SelfHealingPatch;
    
    if (fullPatch.confidenceScore < SELF_HEAL_CONFIDENCE_THRESHOLD) {
      fullPatch.status = "low_confidence";
      return fullPatch;
    }

    // Attempt to parse the patched content if it's a TS/JS file
    if (fullPatch.file.endsWith(".ts") || fullPatch.file.endsWith(".tsx") || fullPatch.file.endsWith(".js") || fullPatch.file.endsWith(".jsx")) {
      const lines = originalContent.split("\n");
      const startLine = (fullPatch.startLine || fullPatch.endLine) - 1;
      const endLine = fullPatch.endLine - 1;
      
      const patchedLines = [
        ...lines.slice(0, startLine),
        fullPatch.suggestionBody,
        ...lines.slice(endLine + 1)
      ];
      
      const patchedContent = patchedLines.join("\n");
      
      // Basic syntax check using TS compiler API
      const sourceFile = ts.createSourceFile(
        fullPatch.file,
        patchedContent,
        ts.ScriptTarget.Latest,
        true
      );
      
      // Check for syntax errors
      const sfAny = sourceFile as any;
      const hasErrors = sfAny.parseDiagnostics && sfAny.parseDiagnostics.length > 0;
      if (hasErrors) {
        fullPatch.status = "invalid_syntax";
        return fullPatch;
      }
    }

    fullPatch.status = "valid";
    return fullPatch;
  }
}
