'use strict';

var logViewerApp = angular.module('logviewer', ['treeherder']);

logViewerApp.config(function($compileProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);
});
