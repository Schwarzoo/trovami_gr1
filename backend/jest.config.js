/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    '<rootDir>/controllers/**/*.js',
    '<rootDir>/services/**/*.js',
    '<rootDir>/middleware/**/*.js',
    '<rootDir>/routes/**/*.js'
  ],
  coverageReporters: ['text', 'text-summary']
};

