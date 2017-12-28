'use strict';

var failureViewerApp = angular.module('failureviewer', ['treeherder']);

failureViewerApp.config(['$compileProvider', '$locationProvider',
        function ($compileProvider, $locationProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);

    // Revert to the legacy Angular <=1.5 URL hash prefix to save breaking existing links:
    // https://docs.angularjs.org/guide/migration#commit-aa077e8
    $locationProvider.hashPrefix('');
}]).run(require('./cache-templates'));

module.exports = failureViewerApp;
