const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  preset: 'jest-puppeteer',
  testMatch: ['**/tests/ui/integration/**/*_test.jsx'],
  moduleFileExtensions: ['web.jsx', 'web.js', 'wasm', 'jsx', 'js', 'json'],
  testTimeout: 120000,
  verbose: true,

  // Use SWC for faster transforms
  transform: {
    '\\.(mjs|jsx|js)$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'ecmascript',
            jsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },

  // Module name mappers for static assets
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/tests/jest/file-mock.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/jest/style-mock.js',
  },

  // Global setup for puppeteer tests
  globals: {
    URL: 'http://localhost:5000',
  },
};
