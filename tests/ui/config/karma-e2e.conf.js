module.exports = function (config) {
    config.set({
        frameworks: ['requirejs'],

        basePath: '../',

        files: [
            'app/vendor/angular/angular.js',
            'app/vendor/angular/angular-*.js',
            'app/vendor/*.js',
            'app/js/**/*.js',
            'app/js/controllers/**/*.js',
            'test/vendor/angular/angular-mocks.js',
            'test/vendor/jquery-2.0.3.js',
            'test/vendor/jasmine-jquery.js',
            'test/e2e/**/*.js',

            // fixtures
            {pattern: 'app/resources/*.json', watched: true, served: true, included: false}
        ],

        autoWatch: false,
        singleRun: true,

        browsers: ['Firefox'],

        proxies: {
          '/': 'http://localhost:8000/'
        },

        junitReporter: {
          outputFile: 'test_out/e2e.xml',
          suite: 'e2e'
        }
    });
};
