const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.tsx',
    '<rootDir>/app/**/__tests__/**/*.test.ts',
    '<rootDir>/app/**/__tests__/**/*.test.tsx',
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/services/(.*)$': '<rootDir>/services/$1',
    '^@/(?!lib/|app/|services/)(.*)$': '<rootDir>/src/$1',
    '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
    '^@panva/hkdf$': '<rootDir>/node_modules/@panva/hkdf/dist/node/cjs/index.js',
    '^uuid$': require.resolve('uuid'),
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/dist-worker/',
    '<rootDir>/node_modules/',
  ],
};

module.exports = createJestConfig(customJestConfig);
