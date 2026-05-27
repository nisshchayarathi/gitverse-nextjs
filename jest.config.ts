import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/lib/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.tsx',
    '<rootDir>/app/**/*.test.ts',
    '<rootDir>/app/**/*.test.tsx',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
