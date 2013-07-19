frameworks = ['jasmine'];

basePath = '../';

files = [
  JASMINE,
  JASMINE_ADAPTER,
  'app/vendor/angular/angular.js',
  'app/vendor/angular/angular-*.js',
  'app/vendor/*.js',
  'app/js/**/*.js',
  'app/js/controllers/**/*.js',
  'test/vendor/angular/angular-mocks.js',
  'test/vendor/jquery-2.0.3.js',
  'test/vendor/jasmine-jquery.js',
  'test/unit/**/*.js',

  // fixtures
  {pattern: 'app/resources/*.json', watched: true, served: true, included: false}
];

autoWatch = false;
singleRun = true;

browsers = ['Chrome'];

junitReporter = {
  outputFile: 'test_out/unit.xml',
  suite: 'unit'
};
