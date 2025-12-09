const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['web.jsx', 'web.js', 'wasm', 'jsx', 'js', 'json'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/tests/jest/file-mock.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/jest/style-mock.js',
    '^react-native$': '<rootDir>/node_modules/react-native-web',
    '^react-resizable-panels$':
      '<rootDir>/tests/jest/react-resizable-panels-mock.js',
  },
  bail: true,
  collectCoverageFrom: ['ui/**/*.{mjs,jsx,js}'],
  testEnvironment: 'jsdom',
  testRegex: 'ui/.*(_test|_spec|\\.test|\\.spec)\\.(mjs|jsx|js)$',
  verbose: true,

  // Use SWC for faster transforms (20-70x faster than babel-jest)
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
  transformIgnorePatterns: ['node_modules/(?!taskcluster-client-web)'],
  setupFilesAfterEnv: ['<rootDir>/tests/ui/test-setup.js'],
  testPathIgnorePatterns: ['tests/ui/integration'],

  // Enable Jest caching for faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};
