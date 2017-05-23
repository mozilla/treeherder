'use strict';
const karma = require('neutrino-preset-karma');

module.exports = neutrino => {
    neutrino.use(karma, () => ({
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
    }));

    // Add an istanbul loader to generate coverage for js(x) in ui/
    neutrino.config
        .resolve
            .modules
                // tests/ui/unit/init.js does its own module look-ups,
                // so remove relative look-ups to avoid errors
                .delete('node_modules')
                .end()
            .end()
        .module
            .rule('coverage')
                .test(/\.jsx?$/)
                .post()
                .include
                    .add(neutrino.options.source).end()
                .use('istanbul')
                    .loader(require.resolve('istanbul-instrumenter-loader'));
};
