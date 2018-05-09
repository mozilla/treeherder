'use strict';
const basePreset = require('./base');
const CleanPlugin = require('clean-webpack-plugin');
const CWD = require('./base').CWD;
const DIST = require('./base').DIST;

module.exports = neutrino => {
    basePreset(neutrino);

    neutrino.config.plugin('minify')
        .inject(BabiliPlugin => new BabiliPlugin({
            evaluate: false, // prevents some minification errors
            // Prevents a minification error in react-dom that manifests as
            // `ReferenceError: Hp is not defined` when loading the main jobs view (bug 1426902).
            // TODO: Either remove this workaround or file upstream if this persists
            // after the Neutrino upgrade (which comes with latest babel-plugin-minify-mangle-names).
            mangle: {
                keepFnName: true,
            },
        }
    ));

    neutrino.config.plugin('clean')
        .use(CleanPlugin, [DIST], { root: CWD } );

};
