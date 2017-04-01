const { Neutrino } = require('neutrino');
const { neutrino } = require('./package.json');

const api = Neutrino(neutrino.options);

neutrino.use.map(middleware => api.use(require(middleware)));
module.exports = api.eslintrc();
