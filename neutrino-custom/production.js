'use strict';
const webpack = require('webpack');
const basePreset = require('./base');
const CWD = require('./base').CWD;
const UI = require('./base').UI;
const DIST = require('./base').DIST;
const CopyPlugin = require('copy-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');

// The service domain is used to determine whether login is available in the auth component.
let SERVICE_DOMAIN = process.env.SERVICE_DOMAIN;

module.exports = neutrino => {
    basePreset(neutrino);

    // We must alter the context for the copy plugin:
    neutrino.config.plugin('copy')
        .use(CopyPlugin, [{
            context: UI,
            from: '*/**'
        }], {
            ignore: ['*.js', '*.jsx', '*.css']
        });

    // Define the service domain globally so that window.thServiceDomain can be set:
    neutrino.config
        .plugin('define')
        .use(webpack.DefinePlugin, {
            SERVICE_DOMAIN: JSON.stringify(SERVICE_DOMAIN)
        });

    // Update the clean plugin to clean dist/ instead of the default build/:
    neutrino.config.plugin('clean')
        .use(CleanPlugin, [DIST], {root: CWD});
};
