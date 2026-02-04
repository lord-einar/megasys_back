// jest.config.mjs
export default {
  testEnvironment: 'node',
  transform: {},
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/testSetup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/seeders/**'
  ],
  testMatch: ['**/__tests__/**/*.test.js']
};
