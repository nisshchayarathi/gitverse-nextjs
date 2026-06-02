"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretDetector = exports.SecretDetectorService = void 0;
const entropy_analysis_1 = require("./entropy-analysis");
const geminiService_1 = require("./geminiService");
const SECRET_PATTERNS = [
    { provider: 'AWS', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/, severity: 'Critical' },
    { provider: 'AWS', regex: /aws_secret_access_key\s*=\s*['"]?[a-zA-Z0-9/+=]{40}['"]?/i, severity: 'Critical' },
    { provider: 'GCP', regex: /AIza[0-9A-Za-z-_]{35}/i, severity: 'High' },
    { provider: 'Azure', regex: /[a-z0-9+/=]{44,48}/i, severity: 'High' }, // High entropy generic
    { provider: 'GitHub', regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/, severity: 'Critical' },
    { provider: 'GitLab', regex: /glpat-[0-9a-zA-Z\-]{20}/, severity: 'Critical' },
    { provider: 'Stripe', regex: /(?:sk_live|rk_live)_[a-zA-Z0-9]{24,99}/, severity: 'Critical' },
    { provider: 'Stripe', regex: /(?:sk_test|rk_test)_[a-zA-Z0-9]{24,99}/, severity: 'Low' },
    { provider: 'MongoDB', regex: /mongodb(?:\+srv)?:\/\/[^\s]+/i, severity: 'High' },
    { provider: 'PostgreSQL', regex: /postgres(?:\+?[^\s]*)?:\/\/[^\s]+/i, severity: 'High' },
    { provider: 'JWT', regex: /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, severity: 'Medium' },
];
class SecretDetectorService {
    geminiService = new geminiService_1.GeminiService();
    async scanFile(filePath, content) {
        const lines = content.split('\n');
        const results = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of SECRET_PATTERNS) {
                const match = line.match(pattern.regex);
                if (match) {
                    const matchedString = match[0];
                    const isDummy = await this.verifyWithAI(filePath, line, matchedString);
                    let severity = pattern.severity;
                    if (isDummy)
                        severity = 'Low';
                    results.push({
                        provider: pattern.provider,
                        severity,
                        match: matchedString,
                        maskedMatch: this.maskSecret(matchedString),
                        lineNumber: i + 1,
                        filePath,
                        entropyScore: entropy_analysis_1.entropyAnalysis.calculateEntropy(matchedString),
                        confidenceScore: entropy_analysis_1.entropyAnalysis.getEntropyConfidenceScore(matchedString),
                        isLikelySafe: isDummy
                    });
                }
            }
        }
        return results;
    }
    maskSecret(secret) {
        if (secret.length <= 4)
            return '****';
        const prefixLength = Math.min(6, Math.floor(secret.length / 3));
        return secret.substring(0, prefixLength) + '*'.repeat(secret.length - prefixLength);
    }
    async verifyWithAI(filePath, lineContext, secret) {
        try {
            const prompt = `Analyze this code snippet from file "${filePath}" to determine if the credential string is likely a dummy/fake value used for documentation/examples, or a real live secret.

Code context:
\`\`\`
${lineContext}
\`\`\`
Secret: ${secret}

Respond with only a JSON object: {"isDummy": boolean, "reason": "short explanation"}
`;
            const response = await this.geminiService.chatRaw(prompt);
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return result.isDummy === true;
            }
        }
        catch (e) {
            console.warn("AI verification failed, defaulting to false (not a dummy)", e);
        }
        return false;
    }
}
exports.SecretDetectorService = SecretDetectorService;
exports.secretDetector = new SecretDetectorService();
