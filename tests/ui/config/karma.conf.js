module.exports = function (config) {
    config.set({
        frameworks: ['jasmine'],

        basePath: '../',

        files: [
            'app/vendor/angular/angular.js',
            'app/vendor/angular/angular-*.js',
            'app/vendor/ui-bootstrap-*.js',
            'app/vendor/jquery-*.js',
            'app/vendor/jquery.ui.effect.js',
            'app/vendor/jquery.ui.effect-highlight.js',
            'app/vendor/bootstrap*.js',
            'app/vendor/zeroclipboard/*.js',
            'app/vendor/ng-clip*.js',
            'app/js/*.js',
            'app/js/controllers/**/*.js',
            'app/js/directives/**/*.js',
            'app/js/models/**/*.js',
            'app/js/services/**/*.js',
            'app/js/config/sample.local.conf.js',
            'app/plugins/**/*.js',
            'test/vendor/angular/angular-mocks.js',
            'test/vendor/jasmine-jquery.js',
            'test/unit/**/*.js',
            'app/vendor/*.js',

            // fixtures
            {pattern: 'test/mock/*.json', watched: true, served: true, included: false}
        ],

        autoWatch: false,
        singleRun: true,

        logLevel: config.LOG_INFO,

        browsers: ['Firefox'],

        junitReporter: {
          outputFile: 'test_out/unit.xml',
          suite: 'unit'
        },

        reporters: ['progress', 'coverage'],
        preprocessors: {
            'app/js/**/*.js': ['coverage']
        }
    });
};
