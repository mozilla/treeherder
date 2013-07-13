basePath = '../';

files = [
  JASMINE,
  JASMINE_ADAPTER,
  'app/vendor/angular/angular.js',
  'app/vendor/angular/angular-*.js',
  'app/js/*.js',
  'app/js/controllers/*.js',
  'test/vendor/angular/angular-mocks.js',
  'test/unit/*.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
  outputFile: 'test_out/unit.xml',
  suite: 'unit'
};
