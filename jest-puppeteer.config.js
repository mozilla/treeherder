module.exports = {
  launch: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  server: {
    command: 'PORT=3000 yarn start',
    port: 3000,
    launchTimeout: 120000,
    debug: true,
    waitOnScheme: {
      delay: 1000,
      interval: 1000,
      timeout: 60000,
    },
  },
};
