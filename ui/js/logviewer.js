'use strict';

var logViewerApp = angular.module('logviewer', ['treeherder']);

logViewerApp.config(['$compileProvider', '$resourceProvider',
    function($compileProvider, $resourceProvider) {
        // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);

        // Don't strip trailing slashes from calculated URLs
        $resourceProvider.defaults.stripTrailingSlashes = false;

        // All queries should be cancellable by default (why is this configurable??)
        $resourceProvider.defaults.cancellable = true;
    }]);

module.exports = logViewerApp;
