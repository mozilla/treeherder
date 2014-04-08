// Karma configuration
// Generated on Mon Apr 07 2014 17:41:06 GMT-0700 (PDT)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '..',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
            'app/vendor/angular/angular.js',
            'app/vendor/angular/angular-*.js',
            'app/vendor/ui-bootstrap-*.js',
            'app/vendor/jquery-*.js',
            'app/vendor/jquery.ui.effect.js',
            'app/vendor/jquery.ui.effect-highlight.js',
            'app/vendor/bootstrap*.js',
            'app/js/app.js',
            'app/js/**/*.js',
            'app/js/controllers/**/*.js',
            'app/js/services/**/*.js',
            'app/js/models/**/*.js',
            'app/plugins/**/*.js',
            'test/vendor/angular/angular-mocks.js',
            'test/vendor/jasmine-jquery.js',
            'test/unit/**/*.js',
            'app/vendor/*.js',

            // fixtures
            {pattern: 'test/mock/*.json', watched: true, served: true, included: false}
    ],


    // list of files to exclude
    exclude: [

    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
        'app/js/**/*.js': ['coverage']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'coverage'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Firefox'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true
  });
};
