'use strict';
const basePreset = require('./base');
const karmaPreset = require('neutrino-preset-karma');
const UI = require('./base').UI;

module.exports = neutrino => {
    basePreset(neutrino);
    karmaPreset(neutrino);

    // Add an isntanbul loader to generate coverage for js(x) in ui/
    neutrino.config.module
        .rule('coverage')
        .post()
        .include(UI)
        .test(/\.jsx?$/)
        .loader('istanbul', require.resolve('istanbul-instrumenter-loader'));

    // Normal karma config
    neutrino.custom.karma = {
        browsers: ['Firefox'],
        coverageIstanbulReporter: {
            reports: ['html'],
            fixWebpackSourcePaths: true
        },
        plugins: [
            require.resolve('karma-webpack'),
            require.resolve('karma-firefox-launcher'),
            require.resolve('karma-coverage'),
            require.resolve('karma-jasmine'),
            require.resolve('karma-coverage-istanbul-reporter')
        ],
        frameworks: ['jasmine'],
        files: [
            'tests/ui/unit/init.js',
            { pattern: 'tests/ui/mock/**/*.json', watched: true, served: true, included: false }
        ],
        preprocessors: {
            'tests/ui/unit/init.js': ['webpack'],
        },
        reporters: ['progress', 'coverage-istanbul'],
    };
};
