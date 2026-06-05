export class EntropyAnalysisService {
  /**
   * Calculates the Shannon entropy of a string.
   * Higher entropy indicates more randomness.
   */
  public calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;

    const charCounts: Record<string, number> = {};
    for (const char of str) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;

    for (const char in charCounts) {
      const p = charCounts[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Determines if a string has a suspiciously high entropy for its character set.
   * Typically, base64 or hex encoded secrets have high entropy.
   */
  public isSuspiciouslyHighEntropy(str: string, threshold = 4.5): boolean {
    return this.calculateEntropy(str) > threshold;
  }

  /**
   * Returns a confidence score (0 to 100) based on entropy.
   */
  public getEntropyConfidenceScore(str: string): number {
    const entropy = this.calculateEntropy(str);
    // Normalize entropy score somewhat to a 0-100 scale.
    // Natural English text is usually around 3.5-4.0.
    // Base64 strings can be 5.0+.
    if (entropy < 3.5) return 10;
    if (entropy < 4.0) return 30;
    if (entropy < 4.5) return 60;
    if (entropy < 5.0) return 85;
    return 95;
  }
}

export const entropyAnalysis = new EntropyAnalysisService();
