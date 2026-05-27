"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
describe('lib/utils', () => {
    it('merges class names deterministically', () => {
        expect((0, utils_1.cn)('a', 'b')).toBe('a b');
        expect((0, utils_1.cn)('p-2', 'p-4')).toBe('p-4');
        expect((0, utils_1.cn)('text-sm', false && 'hidden', 'text-sm')).toBe('text-sm');
    });
});
