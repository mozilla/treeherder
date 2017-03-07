'use strict';

var failureViewerApp = angular.module('failureviewer', ['treeherder']);

failureViewerApp.config(['$compileProvider', function($compileProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);
}]);

module.exports = failureViewerApp;
