const neutrino = require('neutrino');

module.exports = (env = {}) => {
  // Convert `--env.NAME <value>` CLI arguments into environment variables.
  // This makes it possible to write cross-platform-compatible package.json `scripts`.
  Object.entries(env).forEach(([name, value]) => {
    process.env[name] = value;
  });
  return neutrino().webpack();
};
