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
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/dist-worker/',
    '<rootDir>/node_modules/',
  ],
};

module.exports = async () => {
  const nextJestConfig = await createJestConfig(customJestConfig)();
  
  nextJestConfig.transformIgnorePatterns = [
    '/node_modules/(?!(jose|@panva|oauth4webapi|uuid)/)',
    ...nextJestConfig.transformIgnorePatterns.filter(pattern => pattern !== '/node_modules/'),
  ];
  
  return nextJestConfig;
};
