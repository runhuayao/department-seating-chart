export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\.(js|jsx|ts|tsx)$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1'
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'api/**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  verbose: true
};