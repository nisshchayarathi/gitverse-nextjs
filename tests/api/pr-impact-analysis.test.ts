import { describe, it, expect, vi } from 'vitest';
import { RiskScorer } from '../../lib/services/riskScorer';

describe('PR Impact Analysis', () => {
  describe('RiskScorer', () => {
    it('Scenario 1: Small UI-only PR should return Low risk', () => {
      const changedFiles = ['src/components/Button.tsx'];
      const impact = {
        affectedFiles: [],
        dependencyPaths: {},
        downstreamCount: 0
      };
      
      const result = RiskScorer.calculateRisk(changedFiles, impact, []);
      expect(result.level).toBe('LOW');
      expect(result.score).toBe(0);
    });

    it('Scenario 2: Core utility modified should return Medium/High risk', () => {
      const changedFiles = ['src/utils/core.ts'];
      const impact = {
        affectedFiles: ['src/a.ts', 'src/b.ts'],
        dependencyPaths: {},
        downstreamCount: 2
      };
      
      const result = RiskScorer.calculateRisk(changedFiles, impact, []);
      // 25 points for core touched -> Medium
      expect(result.level).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(25);
    });

    it('Scenario 3: Authentication module modified should generate Risk warning (High/Critical)', () => {
      const changedFiles = ['src/auth/login.ts'];
      const impact = {
        affectedFiles: ['src/app.ts'],
        dependencyPaths: {},
        downstreamCount: 1
      };
      
      const result = RiskScorer.calculateRisk(changedFiles, impact, []);
      // 50 points for auth touched -> High
      expect(result.level).toBe('HIGH');
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.factors).toContain('Authentication/Security module modified (src/auth/login.ts)');
    });

    it('Scenario 4: New circular dependency introduced should return Architectural drift warning', () => {
      const changedFiles = ['src/a.ts'];
      const impact = {
        affectedFiles: [],
        dependencyPaths: {},
        downstreamCount: 0
      };
      
      const result = RiskScorer.calculateRisk(changedFiles, impact, ['Circular dependency detected']);
      // 20 points for drift -> LOW (20)
      expect(result.score).toBe(20);
      expect(result.factors).toContain('Architectural drift detected (1 warnings)');
    });

    it('Scenario 5: Shared API contract modified should identify dependency impact', () => {
      const changedFiles = ['src/api/contract.ts'];
      const impact = {
        affectedFiles: new Array(35).fill('file.ts'), // 35 files
        dependencyPaths: {},
        downstreamCount: 35
      };
      
      const result = RiskScorer.calculateRisk(changedFiles, impact, []);
      // 40 points for downstream > 30 -> Medium
      expect(result.level).toBe('MEDIUM');
      expect(result.score).toBe(40);
      expect(result.factors).toContain('Extensive downstream impact (35 affected files)');
    });
  });
});
