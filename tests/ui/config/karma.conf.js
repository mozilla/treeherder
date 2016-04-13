'use strict';

// NOTE:  IF TESTS WON'T RUN
// angular-scenario.js in the vendor lib will prevent the
// Karma tests from running.  Delete it when upgrading AngularJS.

module.exports = function (config) {
    config.set({
        frameworks: ['jasmine'],

        basePath: '../../../',

        files: [
            'ui/vendor/angular/angular.js',
            'ui/vendor/angular/angular-*.js',
            'ui/vendor/ui-bootstrap-*.js',
            'ui/vendor/jquery-*.js',
            'ui/vendor/jquery.ui.effect.js',
            'ui/vendor/jquery.ui.effect-highlight.js',
            'ui/vendor/bootstrap*.js',
            'ui/js/treeherder.js',
            'ui/js/filters.js',
            'ui/js/providers.js',
            'ui/js/values.js',
            'ui/js/logviewer.js',
            'ui/js/failureviewer.js',
            'ui/js/userguide.js',
            'ui/js/admin.js',
            'ui/js/treeherder_app.js',
            'ui/js/controllers/*.js',
            'ui/js/directives/treeherder/**/*.js',
            'ui/js/models/**/*.js',
            'ui/js/services/**/*.js',
            'ui/plugins/**/*.js',
            'tests/ui/vendor/jasmine-jquery.js',
            'tests/ui/unit/**/*.js',
            'ui/vendor/*.js',

            // fixtures
            {pattern: 'tests/ui/mock/**/*.json', watched: true, served: true, included: false}
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
            'ui/js/**/*.js': ['coverage']
        }
    });
};
