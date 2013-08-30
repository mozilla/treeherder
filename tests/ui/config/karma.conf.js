module.exports = function (config) {
    config.set({
        frameworks: ['jasmine'],

        basePath: '../',

        files: [
          'app/vendor/angular/angular.js',
          'app/vendor/angular/angular-*.js',
          'app/vendor/*.js',
          'app/js/**/*.js',
          'app/js/controllers/**/*.js',
          'test/vendor/angular/angular-mocks.js',
          'test/vendor/jquery-2.0.3.js',
          'test/vendor/jasmine.js',
          'test/vendor/jasmine-jquery.js',
          'test/unit/**/*.js',

          // fixtures
          {pattern: 'test/mock/*.json', watched: true, served: true, included: false}
        ],

        autoWatch: false,
        singleRun: true,

        browsers: ['Firefox'],

        junitReporter: {
          outputFile: 'test_out/unit.xml',
          suite: 'unit'
        }
    });
};
