export default {
  testEnvironment: 'node',
  // Default Jest testMatch picks up ANY .js file under any __tests__/
  // directory, including our helpers/ subfolder (fake repositories).
  // Restricting to *.test.js keeps those helpers from being run as
  // (empty) test suites in their own right.
  testMatch: ['**/__tests__/**/*.test.js'],
};