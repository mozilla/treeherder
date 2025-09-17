const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  displayName: 'Integration Tests',
  testMatch: ['<rootDir>/tests/ui/integration/**/*_test.jsx'],
  testEnvironment: 'jest-environment-puppeteer',
  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['web.jsx', 'web.js', 'wasm', 'jsx', 'js', 'json'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/tests/jest/file-mock.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/jest/style-mock.js',
    '^react-native$': '<rootDir>/node_modules/react-native-web',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/ui/integration/test-setup.js'],
  testTimeout: 120000,
  verbose: true,
  transform: {
    '\\.(mjs|jsx|js)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!taskcluster-client-web)'],
  globals: {
    URL: 'http://localhost:3000',
  },
  // Puppeteer-specific configuration
  preset: 'jest-puppeteer',
  // Allow tests to access global page and browser objects
  testEnvironmentOptions: {
    // Custom options can be added here if needed
  },
};
