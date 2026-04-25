module.exports = {
  launch: {
    headless: true,
  },
  server: {
    command: 'BROWSER=none pnpm start',
    port: 5000,
    launchTimeout: 30000,
    usedPortAction: 'ignore',
  },
};
