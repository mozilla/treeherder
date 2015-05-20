/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// NOTE:  IF TESTS WON'T RUN
// angular-scenario.js in the vendor lib will prevent the
// Karma tests from running.  Delete it when upgrading AngularJS.

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
            'app/js/treeherder.js',
            'app/js/filters.js',
            'app/js/providers.js',
            'app/js/values.js',
            'app/js/logviewer.js',
            'app/js/treeherder_app.js',
            'app/js/controllers/**/*.js',
            'app/js/directives/**/*.js',
            'app/js/models/**/*.js',
            'app/js/services/**/*.js',
            'app/plugins/**/*.js',
            'test/vendor/jasmine-jquery.js',
            'test/unit/**/*.js',
            'app/vendor/*.js',

            // fixtures
            {pattern: 'test/mock/**/*.json', watched: true, served: true, included: false}
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
