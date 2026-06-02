import { EntropyAnalysisService, entropyAnalysis } from "../entropy-analysis";

describe("EntropyAnalysisService", () => {
  let service: EntropyAnalysisService;

  beforeEach(() => {
    service = new EntropyAnalysisService();
  });

  describe("calculateEntropy", () => {
    it("should return 0 for empty string", () => {
      expect(service.calculateEntropy("")).toBe(0);
    });

    it("should return 0 for single character (only one unique char)", () => {
      expect(service.calculateEntropy("a")).toBe(0);
    });

    it("should return higher entropy for random strings", () => {
      const lowEntropy = service.calculateEntropy("aaaaaaaa");
      const highEntropy = service.calculateEntropy("aT8!@#\$");
      
      expect(highEntropy).toBeGreaterThan(lowEntropy);
    });

    it("should return 0 for single character repeated", () => {
      expect(service.calculateEntropy("aaaaaaa")).toBe(0);
    });

    it("should return 0 for two equal characters", () => {
      expect(service.calculateEntropy("aa")).toBe(0);
    });

    it("should calculate non-zero entropy for two different characters", () => {
      expect(service.calculateEntropy("ab")).toBeGreaterThan(0);
    });

    it("should handle mixed case letters", () => {
      const result = service.calculateEntropy("aAbB");
      expect(result).toBeGreaterThan(0);
    });

    it("should handle numbers", () => {
      const result = service.calculateEntropy("0123456789");
      expect(result).toBeGreaterThan(0);
    });

    it("should return high entropy for alphanumeric strings", () => {
      const entropy = service.calculateEntropy("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
      expect(entropy).toBeGreaterThan(5);
    });
  });

  describe("isSuspiciouslyHighEntropy", () => {
    it("should return false for low entropy strings", () => {
      expect(service.isSuspiciouslyHighEntropy("aaaaaaaa")).toBe(false);
    });

    it("should return false for repeated characters", () => {
      expect(service.isSuspiciouslyHighEntropy("aaaa")).toBe(false);
    });

    it("should use custom threshold when provided", () => {
      const highEntropy = "abcdefghijklmnopqrstuvwxyz";
      expect(service.isSuspiciouslyHighEntropy(highEntropy, 6.0)).toBe(false);
      expect(service.isSuspiciouslyHighEntropy(highEntropy, 3.0)).toBe(true);
    });

    it("should default to 4.5 threshold", () => {
      const result = service.isSuspiciouslyHighEntropy("aaaaaaaa");
      expect(result).toBe(false);
    });

    it("should detect high entropy base64-like strings", () => {
      const result = service.isSuspiciouslyHighEntropy("YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=", 4.0);
      expect(result).toBe(true);
    });
  });

  describe("getEntropyConfidenceScore", () => {
    it("should return 10 for very low entropy strings", () => {
      expect(service.getEntropyConfidenceScore("aaaaaaaa")).toBe(10);
    });

    it("should return higher scores for higher entropy", () => {
      const score1 = service.getEntropyConfidenceScore("abcdefgh");
      const score2 = service.getEntropyConfidenceScore("abcdefghijklmnop");
      expect(score2).toBeGreaterThanOrEqual(score1);
    });

    it("should return 95 for very high entropy strings", () => {
      const result = service.getEntropyConfidenceScore("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#\$%^&*()");
      expect(result).toBe(95);
    });

    it("should increase score as entropy increases", () => {
      const scores = [
        service.getEntropyConfidenceScore("aa"),
        service.getEntropyConfidenceScore("abcdef"),
        service.getEntropyConfidenceScore("abcdefghij"),
        service.getEntropyConfidenceScore("abcdefghijklmnop"),
        service.getEntropyConfidenceScore("abcdefghijklmnopqrstuvwxyz"),
      ];
      
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe("exported instance", () => {
    it("should have all methods available on exported instance", () => {
      expect(typeof entropyAnalysis.calculateEntropy).toBe("function");
      expect(typeof entropyAnalysis.isSuspiciouslyHighEntropy).toBe("function");
      expect(typeof entropyAnalysis.getEntropyConfidenceScore).toBe("function");
    });

    it("exported instance should produce same results as new instance", () => {
      const testString = "test@123";
      expect(entropyAnalysis.calculateEntropy(testString)).toBe(
        service.calculateEntropy(testString)
      );
    });

    it("exported instance should be usable standalone", () => {
      const entropy = entropyAnalysis.calculateEntropy("sample");
      expect(entropy).toBeGreaterThan(0);
    });
  });
});
