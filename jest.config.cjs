const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  rootDir: __dirname.replace(/\\/g, '/'),
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

const jestConfig = createJestConfig(customJestConfig);

module.exports = async () => {
  const config = await jestConfig();
  const normalize = (obj) => {
    if (!obj) return;
    if (obj.rootDir && typeof obj.rootDir === 'string') {
      obj.rootDir = obj.rootDir.replace(/\\/g, '/');
    }
    if (obj.testMatch && Array.isArray(obj.testMatch)) {
      obj.testMatch = obj.testMatch.map(p => typeof p === 'string' ? p.replace(/\\/g, '/') : p);
    }
  };
  normalize(config);
  if (config.config) {
    normalize(config.config);
  }
  return config;
};
