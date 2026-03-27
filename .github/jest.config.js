module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 10000
};
