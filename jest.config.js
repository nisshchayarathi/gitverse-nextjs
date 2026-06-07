/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
  '^@/lib/(.*)$': '<rootDir>/lib/$1',
  '^@/app/(.*)$': '<rootDir>/app/$1',
  '^@/(.*)$': '<rootDir>/src/$1',
},
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
      },
    }],
  },
};

module.exports = config;