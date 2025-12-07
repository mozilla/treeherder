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
  transform: {
    '\\.(mjs|jsx|js)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!taskcluster-client-web)'],
  setupFilesAfterEnv: ['<rootDir>/tests/ui/test-setup.js'],
  testPathIgnorePatterns: ['tests/ui/integration'],
};
