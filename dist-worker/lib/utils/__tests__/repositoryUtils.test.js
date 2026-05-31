"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const repositoryUtils_1 = require("../repositoryUtils");
describe('repositoryUtils', () => {
    describe('getLanguageColor', () => {
        it('returns custom hex for supported language', () => {
            expect((0, repositoryUtils_1.getLanguageColor)('TypeScript')).toBe('#3178c6');
            expect((0, repositoryUtils_1.getLanguageColor)('JavaScript')).toBe('#f1e05a');
        });
        it('returns default fallback color for unsupported language', () => {
            expect((0, repositoryUtils_1.getLanguageColor)('UnknownLang')).toBe('#858585');
        });
    });
    describe('formatFileSize', () => {
        it('formats bytes size correctly', () => {
            expect((0, repositoryUtils_1.formatFileSize)(0)).toBe('0 B');
            expect((0, repositoryUtils_1.formatFileSize)(500)).toBe('500 B');
            expect((0, repositoryUtils_1.formatFileSize)(1024)).toBe('1 KB');
            expect((0, repositoryUtils_1.formatFileSize)(1024 * 1024 * 1.5)).toBe('1.5 MB');
        });
    });
    describe('formatRelativeTime', () => {
        it('returns formatted relative times correctly', () => {
            const now = new Date();
            expect((0, repositoryUtils_1.formatRelativeTime)(new Date(now.getTime() - 10 * 1000))).toBe('Just now');
            expect((0, repositoryUtils_1.formatRelativeTime)(new Date(now.getTime() - 5 * 60 * 1000))).toBe('5m ago');
            expect((0, repositoryUtils_1.formatRelativeTime)(new Date(now.getTime() - 3 * 3600 * 1000))).toBe('3h ago');
        });
    });
    describe('getShortHash', () => {
        it('slices git hash to custom length', () => {
            const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6';
            expect((0, repositoryUtils_1.getShortHash)(hash)).toBe('a1b2c3d');
            expect((0, repositoryUtils_1.getShortHash)(hash, 10)).toBe('a1b2c3d4e5');
        });
    });
    describe('generateAvatar', () => {
        it('returns a DiceBear avatar SVG URL based on seed', () => {
            expect((0, repositoryUtils_1.generateAvatar)('test@example.com')).toContain('seed=test%40example.com');
        });
    });
    describe('parseCommitMessage', () => {
        it('correctly parses conventional commit format', () => {
            const msg = 'feat(ui)!: add modern landing page';
            const parsed = (0, repositoryUtils_1.parseCommitMessage)(msg);
            expect(parsed).toEqual({
                type: 'feat',
                scope: 'ui',
                subject: 'add modern landing page',
                breaking: true
            });
        });
        it('handles non-conventional commits gracefully', () => {
            expect((0, repositoryUtils_1.parseCommitMessage)('random commit')).toEqual({
                subject: 'random commit',
                breaking: false
            });
        });
    });
    describe('branch name detection', () => {
        it('identifies feature branches correctly', () => {
            expect((0, repositoryUtils_1.isFeatureBranch)('feature/ui')).toBe(true);
            expect((0, repositoryUtils_1.isFeatureBranch)('feat/login')).toBe(true);
            expect((0, repositoryUtils_1.isFeatureBranch)('fix/bug')).toBe(false);
        });
        it('identifies bugfix branches correctly', () => {
            expect((0, repositoryUtils_1.isBugfixBranch)('fix/bug')).toBe(true);
            expect((0, repositoryUtils_1.isBugfixBranch)('bugfix/crash')).toBe(true);
            expect((0, repositoryUtils_1.isBugfixBranch)('release/1.0')).toBe(false);
        });
        it('identifies release branches correctly', () => {
            expect((0, repositoryUtils_1.isReleaseBranch)('release/v1')).toBe(true);
            expect((0, repositoryUtils_1.isReleaseBranch)('hotfix/issue')).toBe(true);
        });
    });
    describe('normalizeKnownRepoHttpUrl', () => {
        it('standardizes supported provider repository URLs', () => {
            expect((0, repositoryUtils_1.normalizeKnownRepoHttpUrl)('https://github.com/user/repo.git')).toBe('https://github.com/user/repo');
            expect((0, repositoryUtils_1.normalizeKnownRepoHttpUrl)('https://gitlab.com/group/repo')).toBe('https://gitlab.com/group/repo');
            expect((0, repositoryUtils_1.normalizeKnownRepoHttpUrl)('https://unsupported.com/user/repo')).toBe('https://unsupported.com/user/repo');
            expect((0, repositoryUtils_1.normalizeKnownRepoHttpUrl)('invalid-url')).toBeNull();
        });
    });
    describe('normalizeTargetDirectory', () => {
        it('normalizes target directory path strings', () => {
            expect((0, repositoryUtils_1.normalizeTargetDirectory)(null)).toBeNull();
            expect((0, repositoryUtils_1.normalizeTargetDirectory)('')).toBeNull();
            expect((0, repositoryUtils_1.normalizeTargetDirectory)('./src/components/')).toBe('src/components');
            expect((0, repositoryUtils_1.normalizeTargetDirectory)('src\\utils')).toBe('src/utils');
        });
        it('returns null for directory paths containing path traversal or unsafe characters', () => {
            expect((0, repositoryUtils_1.normalizeTargetDirectory)('../traversal')).toBeNull();
            expect((0, repositoryUtils_1.normalizeTargetDirectory)('src/invalid$Segment')).toBeNull();
        });
    });
});
