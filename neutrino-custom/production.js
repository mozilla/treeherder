'use strict';
const webpack = require('webpack');
const basePreset = require('./base');
const CopyPlugin = require('copy-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');
const CWD = require('./base').CWD;
const UI = require('./base').UI;
const DIST = require('./base').DIST;

// The service domain is used to determine whether login is available in the auth component.
let SERVICE_DOMAIN = process.env.SERVICE_DOMAIN;

module.exports = neutrino => {
    basePreset(neutrino);

    neutrino.config.plugin('minify')
        .inject(BabiliPlugin => new BabiliPlugin({
            evaluate: false, // prevents some minification errors
        }
    ));

    // Define the service domain globally for the thServiceDomain provider:
    neutrino.config.plugin('define')
        .use(webpack.DefinePlugin, {
            SERVICE_DOMAIN: JSON.stringify(SERVICE_DOMAIN)
        });


    // The copy plugin is overwritten and not injected so that when this preset is
    // imported in ./local-watch.js and run via `neutrino start`, it is still included
    // in the config (it is only applied in !development by default):
    neutrino.config.plugin('copy')
        .use(CopyPlugin, [{
            context: UI,
            from: '**'
        }], {
            ignore: ['*.js', '*.jsx', '*.css', '*.html', '*.tmpl',
                '*.eot', '*.otf', '*.ttf', '*.woff', '*.woff2', '*.psd']
        });

    // Likewise for this clean plugin:
    neutrino.config.plugin('clean')
        .use(CleanPlugin, [DIST], { root: CWD } );

};
