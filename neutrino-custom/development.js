'use strict';
const webpack = require('webpack');
const basePreset = require('./base');
const UI = require('./base').UI;

// The service domain is used to determine whether login is available in the auth component.
let SERVICE_DOMAIN = process.env.SERVICE_DOMAIN;

// Set the service domain to production if no environment value was provided, since
// webpack-dev-server doesn't serve data from the vagrant machine.
if (typeof SERVICE_DOMAIN === 'undefined') {
    SERVICE_DOMAIN = 'https://treeherder.mozilla.org';
}

module.exports = neutrino => {
    basePreset(neutrino);

    // Set service domain so that ui/js/config can use it:
    neutrino.config
        .plugin('define')
        .use(webpack.DefinePlugin, {
            SERVICE_DOMAIN: JSON.stringify(SERVICE_DOMAIN)
        });

    // Set up the dev server with an api proxy to the service domain:
    neutrino.config.devServer
        .contentBase(UI)
        .set('proxy', {
            '/api/*': {
                target: SERVICE_DOMAIN,
                changeOrigin: true
            }
        });
};
