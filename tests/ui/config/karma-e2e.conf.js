module.exports = function (config) {
    config.set({
        frameworks: ['ng-scenario'],

        basePath: '../../../',

        files: [
            'tests/ui/e2e/**/*.js',

            // fixtures
            {pattern: 'tests/ui/mock/*.json', watched: true, served: true, included: false}
        ],

        autoWatch: false,
        singleRun: true,

        browsers: ['Firefox'],

        proxies: {
          '/': 'http://localhost:8000/'
        },
        urlRoot: '/',
        plugins : [
            'karma-junit-reporter',
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-jasmine',
            'karma-ng-scenario'
        ],
        junitReporter: {
          outputFile: 'test_out/e2e.xml',
          suite: 'e2e'
        }
    });
};
