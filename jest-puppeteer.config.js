module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  server: {
    command: 'pnpm start:stage',
    port: 5000,
    launchTimeout: 60000,
    debug: true,
  },
};
