module.exports = function (config) {
    config.set({
        frameworks: ['ng-scenario'],

        basePath: '../',

        files: [
            'app/vendor/angular/angular.js',
            'app/vendor/angular/angular-*.js',
            'app/vendor/*.js',
            'app/js/**/*.js',
            'app/js/controllers/**/*.js',
            'test/vendor/angular/angular-mocks.js',
            'test/vendor/angular/angular-scenario.js',
            'test/vendor/jquery-2.0.3.js',
            'test/vendor/jasmine-jquery.js',
            'test/e2e/**/*.js',

            // fixtures
            {pattern: 'test/mock/*.json', watched: true, served: true, included: false}
        ],

        autoWatch: false,
        singleRun: true,

        browsers: ['Firefox'],

        proxies: {
          '/': 'http://localhost:8000/'
        },
        urlRoot: '/__e2e/',
        plugins : [
//            'karma-junit-reporter',
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-jasmine',
//            'karma-ng-scenario'
            ],
        junitReporter: {
          outputFile: 'test_out/e2e.xml',
          suite: 'e2e'
        }
    });
};
