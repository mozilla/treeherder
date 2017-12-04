'use strict';
const basePreset = require('./base');
const karmaPreset = require('neutrino-preset-karma');
const UI = require('./base').UI;

module.exports = neutrino => {
    basePreset(neutrino);
    karmaPreset(neutrino);

    // Normal karma config
    neutrino.custom.karma = {
        browsers: ['Firefox'],
        plugins: [
            require.resolve('karma-webpack'),
            require.resolve('karma-firefox-launcher'),
            require.resolve('karma-jasmine'),
        ],
        frameworks: ['jasmine'],
        files: [
            'tests/ui/unit/init.js',
            { pattern: 'tests/ui/mock/**/*.json', watched: true, served: true, included: false }
        ],
        preprocessors: {
            'tests/ui/unit/init.js': ['webpack'],
        },
    };
};
