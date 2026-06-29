module.exports = {
  preset: 'jest-puppeteer',
  testRegex: 'tests/ui/integration/.*(_test|_spec|\\.test|\\.spec)\\.(mjs|jsx|js)$',
  testTimeout: 30000,
  verbose: true,
};
