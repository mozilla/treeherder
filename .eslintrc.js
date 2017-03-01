const path = require('path');
const Neutrino = require('neutrino');
const api = new Neutrino([path.resolve('./neutrino-custom/development.js')]);

module.exports = api.custom.eslintrc();
