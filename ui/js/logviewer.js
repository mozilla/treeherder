'use strict';

var logViewerApp = angular.module('logviewer', ['treeherder']);

logViewerApp.config(function($compileProvider, $resourceProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);

    // Don't strip trailing slashes from calculated URLs
    $resourceProvider.defaults.stripTrailingSlashes = false;
});
